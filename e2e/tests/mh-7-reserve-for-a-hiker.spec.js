// Acceptance tests for docs/e2e-definitions/MH-7-reserve-for-a-hiker-e2e-scenarios.md.
// Requires a migrated dedicated E2E database and an exclusively used Mailpit instance.
// S5 and S15 cover both alternatives. Prerequisites are checked at runtime, not discovery.
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';

const requireServer = createRequire(new URL('../../server/package.json', import.meta.url));
const PASSWORD = 'quota-e2e-2026';
const MAIL_TIMEOUT = 10_000;
const QUIET_WINDOW = 3_000;
const ROUTE = '/reservations/new';
const zone = process.env.HUT_TIME_ZONE || 'Europe/Rome';
const mailpit = process.env.MAILPIT_URL?.replace(/\/$/, '');
let pool;
let passwordHash;
let fixture;

test.use({ timezoneId: zone, actionTimeout: 5000 });
const escapeRegex = (text) => text.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
const fullName = (hiker) => hiker.firstName + ' ' + hiker.lastName;
const summary = (page) => page.getByRole('complementary', { name: 'Reservation', exact: true });
const saveButton = (page) => page.getByRole('button', { name: 'Save reservation', exact: true });
const results = (page) => page.getByRole('radiogroup', { name: 'Hikers found' });
const hikerOption = (page, hiker) => results(page).getByRole('radio', { name: new RegExp(escapeRegex(fullName(hiker))) });
const get = async (sql, params = [], db = pool) => (await db.query(sql, params)).rows[0] ?? null;
const all = async (sql, params = [], db = pool) => (await db.query(sql, params)).rows;

async function transaction(action) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await action(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Register exact names/emails before requests, including those whose UI assertions may fail.
function identity(label = 'Hiker', overrides = {}) {
  const n = ++fixture.sequence;
  const person = {
    firstName: label,
    lastName: fixture.prefix + ' ' + n,
    email: 'mh7-' + fixture.prefix + '-' + n + '@example.com',
    phone: '+39' + fixture.phonePrefix + String(n).padStart(3, '0'),
    password: PASSWORD,
    ...overrides,
  };
  fixture.names.push(person.lastName);
  if (person.email) fixture.emails.push(person.email);
  return person;
}

async function createUser(label = 'Hiker', overrides = {}, db = pool) {
  const person = identity(label, overrides);
  const temporary = person.temporary ?? false;
  const row = await get(
    'INSERT INTO app_user (first_name,last_name,email,phone,role,password_hash,temporary,must_change_password) ' +
    'VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
    [person.firstName, person.lastName, temporary ? null : person.email, person.phone,
      person.role ?? 'HIKER', temporary ? null : passwordHash, temporary, person.mustChangePassword ?? false], db,
  );
  return { ...person, ...row, email: temporary ? null : person.email, temporary };
}

async function createFixture() {
  const prefix = randomUUID().replaceAll('-', '');
  const next = {
    prefix, phonePrefix: BigInt('0x' + prefix.slice(0, 8)).toString().padStart(10, '0'),
    sequence: 0, names: [], emails: [], slotIds: [], tableSetId: null,
  };
  fixture = next;
  await transaction(async (db) => {
    next.tableSetId = (await get('INSERT INTO table_set (name) VALUES ($1) RETURNING id', ['MH7 ' + prefix], db)).id;
    next.tables = await all(
      'INSERT INTO hut_table (table_set_id,table_number,seat_capacity) VALUES ($1,1,4),($1,2,4) ' +
      'RETURNING id, table_number AS "tableNumber", seat_capacity AS capacity', [next.tableSetId], db,
    );
    next.slot = await get(
      "WITH candidates AS (SELECT ((now() AT TIME ZONE $1)::date + 3) AS day, " +
      "(time '12:00' + n * interval '1 minute') AS start FROM generate_series(0,119) n) " +
      'INSERT INTO slot (service_date,starts_at,ends_at,table_set_id) ' +
      "SELECT day,start,start + interval '1 hour',$2 FROM candidates c " +
      'WHERE NOT EXISTS (SELECT 1 FROM slot s WHERE s.service_date=c.day AND s.starts_at=c.start) ' +
      'ORDER BY start LIMIT 1 ' +
      'RETURNING id AS "slotId", service_date::text AS date, starts_at::text AS "startsAt", ends_at::text AS "endsAt"',
      [zone, next.tableSetId], db,
    );
    if (!next.slot) throw new Error('No slot available in the two-hour fixture range.');
    next.slotIds.push(next.slot.slotId);
    next.employee = await createUser('Employee', { role: 'EMPLOYEE' }, db);
  });
}

async function cleanupFixture() {
  if (!fixture) return;
  await transaction(async (db) => {
    await db.query('DELETE FROM booking WHERE slot_id = ANY($1::int[])', [fixture.slotIds]);
    await db.query('DELETE FROM slot WHERE table_set_id = $1', [fixture.tableSetId]);
    await db.query('DELETE FROM hut_table WHERE table_set_id = $1', [fixture.tableSetId]);
    await db.query('DELETE FROM table_set WHERE id = $1', [fixture.tableSetId]);
    await db.query('DELETE FROM app_user WHERE last_name = ANY($1::text[]) OR email = ANY($2::text[])',
      [fixture.names, fixture.emails]);
  });
  fixture = undefined;
}

const bookingCount = async (hikerId = null) => (await get(
  'SELECT count(*)::int AS n FROM booking WHERE slot_id=$1 AND ($2::int IS NULL OR hiker_id=$2)',
  [fixture.slot.slotId, hikerId],
)).n;
const dataCounts = () => get(
  'SELECT (SELECT count(*)::int FROM app_user) AS users, (SELECT count(*)::int FROM slot) AS slots, ' +
  '(SELECT count(*)::int FROM booking) AS bookings',
);
const accountState = (id) => get(
  'SELECT password_hash AS hash, must_change_password AS required FROM app_user WHERE id=$1', [id],
);

async function compete(hiker, assignments) {
  return transaction(async (db) => {
    const booking = await get(
      'INSERT INTO booking (slot_id,table_set_id,hiker_id,party_size) VALUES ($1,$2,$3,$4) RETURNING id',
      [fixture.slot.slotId, fixture.tableSetId, hiker.id, assignments.reduce((n, a) => n + a.seats, 0)], db,
    );
    for (const assignment of assignments) {
      const table = fixture.tables.find((t) => t.tableNumber === assignment.tableNumber);
      await db.query(
        'INSERT INTO booking_table (booking_id,slot_id,table_set_id,hut_table_id,seat_count) VALUES ($1,$2,$3,$4,$5)',
        [booking.id, fixture.slot.slotId, fixture.tableSetId, table.id, assignment.seats],
      );
    }
    return booking;
  });
}

// Convert an instant to the hut's date/time, carrying midnight and capping the same-day end.
async function moveSlot(minutes) {
  const slot = await get(
    "WITH target AS (SELECT date_trunc('minute', (clock_timestamp() + $2 * interval '1 minute') AT TIME ZONE $3) AS local) " +
    'UPDATE slot SET service_date=local::date, starts_at=local::time, ' +
    "ends_at=LEAST(local + interval '10 minutes', date_trunc('day',local) + interval '1 day' - interval '1 second')::time " +
    'FROM target WHERE id=$1 RETURNING id AS "slotId", service_date::text AS date, ' +
    'starts_at::text AS "startsAt", ends_at::text AS "endsAt"',
    [fixture.slot.slotId, minutes, zone],
  );
  fixture.slot = slot;
  return slot;
}

function matches(response, path, method = 'POST') {
  return new URL(response.url()).pathname === '/api' + path && response.request().method() === method;
}
async function answer(page, path, action, status, method = 'POST') {
  const waiting = page.waitForResponse((r) => matches(r, path, method));
  await action();
  const response = await waiting;
  expect(response.status()).toBe(status);
  return response.status() === 204 ? null : response.json();
}
async function login(page, person) {
  await page.goto('/login');
  await page.getByLabel(/^Email\s*\*?$/).fill(person.email);
  await page.getByLabel(/^Password\s*\*?$/).fill(person.password);
  const user = await answer(page, '/auth/login',
    () => page.getByRole('button', { name: 'Log in', exact: true }).click(), 200);
  await expect(page).toHaveURL(/\/(?:slots|book|change-password)(?:[/?#]|$)/);
  return user;
}
async function openStaff(page) {
  await login(page, fixture.employee);
  await page.goto(ROUTE);
  await expect(page.getByRole('heading', { level: 1, name: 'New reservation', exact: true })).toBeVisible();
}
async function search(page, query) {
  const waiting = page.waitForResponse((r) => matches(r, '/staff/hikers', 'GET') &&
    new URL(r.url()).searchParams.get('q') === query);
  await page.getByRole('searchbox', { name: 'Find the hiker', exact: true }).fill(query);
  const response = await waiting;
  expect(response.status()).toBe(200);
  return response.json();
}
async function chooseHiker(page, person) {
  await search(page, person.email);
  await hikerOption(page, person).click();
  await expect(summary(page)).toContainText(fullName(person));
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return `${WEEKDAYS[parsed.getUTCDay()]} ${day} ${MONTHS[month - 1]}`;
};
const dayChoice = (page, slot = fixture.slot) => page.getByRole('radiogroup', { name: 'Day', exact: true })
  .getByRole('radio', { name: new RegExp(escapeRegex(dayLabel(slot.date)).replaceAll(' ', '\\s+')) });
const timeChoice = (page, slot = fixture.slot) => page.getByRole('radiogroup', { name: 'Time', exact: true })
  .getByRole('radio', { name: new RegExp(escapeRegex(slot.startsAt.slice(0, 5)) + '.*' + escapeRegex(slot.endsAt.slice(0, 5))) });

async function setPeople(page, count) {
  const people = page.getByRole('group', { name: 'How many people', exact: true });
  const output = people.getByRole('status'); // The existing <output> stepper uses the implicit status role.
  const current = Number(await output.innerText());
  expect(Number.isSafeInteger(current)).toBe(true);
  for (let n = current; n !== count; n += n < count ? 1 : -1) {
    await people.getByRole('button', { name: n < count ? 'One more' : 'One fewer' }).click();
  }
  await expect(output).toHaveText(String(count));
}
async function chooseDayAndPeople(page, count) {
  await expect(dayChoice(page)).toBeEnabled();
  await dayChoice(page).click();
  await setPeople(page, count);
}
async function chooseSlot(page, count = 2) {
  await chooseDayAndPeople(page, count);
  await timeChoice(page).click();
  // The UI requests seating on Save. Read the current proposal to establish the fixture.
  const response = await page.request.get('/api/staff/slots/' + fixture.slot.slotId + '/seating', { params: { partySize: count } });
  expect(response.status()).toBe(200);
  const preview = await response.json();
  expect(preview).toMatchObject({ slotId: fixture.slot.slotId, partySize: count });
  await expect(saveButton(page)).toBeEnabled();
  return preview;
}
async function expectLocked(page) {
  await expect(saveButton(page)).toBeDisabled();
  await expect(page.getByText('Choose the hiker first.', { exact: true })).toBeVisible();
  for (const name of ['One more', 'One fewer']) {
    const control = page.getByRole('button', { name, exact: true });
    if (await control.count()) await expect(control).toBeDisabled();
  }
  for (const name of ['Day', 'Time']) {
    const group = page.getByRole('radiogroup', { name, exact: true });
    if (!(await group.count())) continue;
    for (const control of await group.getByRole('radio').all()) {
      await expect(control).toBeDisabled();
    }
  }
}
async function expectChoices(page, person, count, slot = fixture.slot) {
  await expect(summary(page)).toContainText(fullName(person));
  await expect(dayChoice(page, slot)).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('group', { name: 'How many people', exact: true }).getByRole('status')).toHaveText(String(count));
}

// Pause a real request to observe pending UI; release it unchanged to the actual server.
async function pendingAction(page, path, action, control, pendingText, editable = false) {
  let release;
  let reached;
  let timer;
  let finishHandler;
  let routeSeen = false;
  const gate = new Promise((resolve) => { release = resolve; });
  const arrival = new Promise((resolve) => { reached = resolve; });
  const handlerFinished = new Promise((resolve) => { finishHandler = resolve; });
  const handler = async (route) => {
    routeSeen = true;
    reached();
    try {
      await gate;
      await route.continue();
    } finally {
      finishHandler();
    }
  };
  const pattern = '**/api' + path;
  await page.route(pattern, handler);
  try {
    await action();
    await Promise.race([arrival, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('No pending request for ' + path)), 5000);
    })]);
    if (editable) await expect(control).toBeEnabled();
    else await expect(control).toBeDisabled();
    if (pendingText) await expect(page.getByText(pendingText).first()).toBeVisible();
  } finally {
    clearTimeout(timer);
    release();
    if (routeSeen) await handlerFinished;
    await page.unroute(pattern, handler);
  }
}
async function openHikerDialog(page, type) {
  await page.getByRole('button', { name: '+ New hiker', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New hiker', exact: true });
  await selectHikerType(dialog, type);
  return dialog;
}
async function selectHikerType(dialog, type) {
  const option = dialog.getByRole('radio', { name: type, exact: true });
  await option.click();
  await expect(option).toHaveAttribute('aria-checked', 'true');
}
async function fillHiker(dialog, person, full) {
  await dialog.getByLabel(/^First\ name\s*\*?$/).fill(person.firstName);
  await dialog.getByLabel(/^Last\ name\s*\*?$/).fill(person.lastName);
  await dialog.getByLabel(/^Phone\s*\*?$/).fill(person.phone ?? '');
  if (full) await dialog.getByLabel(/^Email\s*\*?$/).fill(person.email);
}
async function addHiker(page, full = true, checkPending = false) {
  const person = identity(full ? 'Full' : 'Quick', full ? {} : { email: null });
  if (full) expect(await recipientMessages(page.request, person.email)).toEqual([]);
  const dialog = await openHikerDialog(page, full ? 'Full profile' : 'Quick entry');
  if (!full) await expect(dialog.getByText(/temporary hiker cannot log in/)).toBeVisible();
  await fillHiker(dialog, person, full);
  await expect(dialog.getByLabel(/password/i)).toHaveCount(0);
  let navigations = 0;
  const onNavigate = (frame) => { if (frame === page.mainFrame()) navigations += 1; };
  page.on('framenavigated', onNavigate);
  let created;
  try {
    created = await answer(page, '/staff/hikers', () => checkPending
      ? pendingAction(page, '/staff/hikers', () => dialog.getByRole('button', { name: 'Add hiker', exact: true }).click(),
        dialog.getByRole('button', { name: /Add hiker|Adding/i }), /Adding/i)
      : dialog.getByRole('button', { name: 'Add hiker', exact: true }).click(), 201);
    await expect(dialog).toBeHidden();
    await expect(summary(page)).toContainText(fullName(person));
    expect(navigations).toBe(0);
  } finally {
    page.off('framenavigated', onNavigate);
  }
  expect(created).toMatchObject({ firstName: person.firstName, lastName: person.lastName, email: person.email, temporary: !full });
  if (full) {
    expect(created.password).toBeTruthy();
    const confirmation = page.getByRole('dialog', { name: 'Hiker account created', exact: true });
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toContainText('Hiker account created');
    await expect(confirmation).toContainText('Generated password');
    await expect(confirmation).toContainText(created.password);
    await confirmation.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(confirmation).toBeHidden();
  } else {
    expect(created).not.toHaveProperty('password');
  }
  return { ...person, ...created };
}
async function save(page, person, preview, pending = false) {
  const booking = await answer(page, '/staff/bookings', () => pending
    ? pendingAction(page, '/staff/bookings', () => saveButton(page).click(),
      page.getByRole('button', { name: /Save reservation|Saving/i }), /Saving/i)
    : saveButton(page).click(), 201);
  expect(booking).toMatchObject({
    slotId: fixture.slot.slotId, date: fixture.slot.date,
    partySize: preview.partySize, tables: preview.tables,
  });
  expect(await get('SELECT hiker_id AS "hikerId", party_size AS "partySize" FROM booking WHERE id=$1', [booking.id]))
    .toEqual({ hikerId: person.id, partySize: preview.partySize });
  expect(await all(
    'SELECT ht.table_number AS "tableNumber", bt.seat_count AS seats FROM booking_table bt ' +
    'JOIN hut_table ht ON ht.id=bt.hut_table_id WHERE bt.booking_id=$1 ORDER BY ht.table_number',
    [booking.id],
  )).toEqual([...preview.tables].sort((a, b) => a.tableNumber - b.tableNumber));
  const saved = page.getByRole('dialog', { name: 'Reservation saved', exact: true });
  await expect(saved).toBeVisible();
  await expect(saved).toContainText(fullName(person));
  await expect(saved).toContainText(dayLabel(booking.date));
  await expect(saved).toContainText(fixture.slot.startsAt.slice(0, 5));
  await expect(saved).toContainText(new RegExp('\\b' + preview.partySize + '\\s+(?:people|person|guests)\\b', 'i'));
  for (const table of preview.tables) {
    await expect(saved).toContainText(new RegExp('T' + table.tableNumber + '\\b'));
  }
  return booking;
}

// Mailpit is exclusive to this E2E run. Global snapshots catch mail for temporary hikers,
// who have no recipient, and mail mistakenly sent to a different address.
async function mailboxTotal(request) {
  const response = await request.get(mailpit + '/api/v1/messages', { params: { limit: 1 } });
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(Number.isInteger(body.total)).toBe(true);
  return body.total;
}
async function recipientMessages(request, email) {
  const response = await request.get(mailpit + '/api/v1/search', { params: { query: 'to:"' + email + '"' } });
  expect(response.ok()).toBe(true);
  return (await response.json()).messages;
}
async function stableMail(check) {
  const deadline = Date.now() + QUIET_WINDOW;
  do {
    await check();
    await new Promise((resolve) => setTimeout(resolve, 150));
  } while (Date.now() < deadline);
}
async function noMail(request, total) {
  await stableMail(async () => expect(await mailboxTotal(request)).toBe(total));
}
async function exactMail(request, email, count) {
  await expect.poll(async () => (await recipientMessages(request, email)).length, { timeout: MAIL_TIMEOUT }).toBe(count);
  await stableMail(async () => expect(await recipientMessages(request, email)).toHaveLength(count));
}
async function messageBySubject(request, email, subject) {
  let found;
  await expect.poll(async () => {
    const messages = await recipientMessages(request, email);
    const matching = messages.filter((message) => subject.test(message.Subject));
    if (matching.length !== 1) return matching.length;
    found = matching[0];
    return 1;
  }, { timeout: MAIL_TIMEOUT }).toBe(1);
  const response = await request.get(mailpit + '/api/v1/message/' + found.ID);
  expect(response.ok()).toBe(true);
  const message = await response.json();
  expect(message.To.map(({ Address }) => Address)).toEqual([email]);
  return message;
}
function expectAccountEmail(message, person) {
  expect(message.Subject).toBe('Your QUOTA account');
  expect(message.Text).toContain(fullName(person));
  expect(message.Text).toContain(person.email);
  expect(message.Text).toMatch(/first time.*log in.*(?:change|choose)/i);
  expect(message.Text).toMatch(/Forgot password\?/);
  expect(message.Text).toMatch(/https?:\/\/[^\s]+\/login\b/);
  const generated = message.Text.match(/^Password: (\S+)\s*$/m)?.[1];
  expect(generated).toBeTruthy();
  return generated;
}
function expectConfirmation(message, person, booking) {
  expect(message.Subject).toContain('QUOTA-' + String(booking.id).padStart(5, '0'));
  expect(message.Text).toContain(fullName(person));
  const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(booking.date + 'T12:00:00Z'));
  expect(message.Text).toContain(date);
  expect(message.Text).toContain(fixture.slot.startsAt.slice(0, 5));
  expect(message.Text).toMatch(new RegExp('Party size:\\s*' + booking.partySize + '\\b'));
}
async function resetLink(page, request, person) {
  expect((await recipientMessages(request, person.email))
    .filter((message) => message.Subject === 'Choose a new password for QUOTA')).toEqual([]);
  await page.goto('/login');
  await page.getByRole('link', { name: 'Forgot password?', exact: true }).click();
  // Both pages have an Email field; wait for the recovery form before filling it.
  await expect(page.getByRole('heading', { name: 'Forgot your password?', exact: true })).toBeVisible();
  await page.getByLabel(/^Email\s*\*?$/).fill(person.email);
  await answer(page, '/auth/password-reset-requests',
    () => page.getByRole('button', { name: 'Send the link', exact: true }).click(), 204);
  await expect(page.getByRole('heading', { name: /Check your email/ })).toBeVisible();
  const message = await messageBySubject(request, person.email, /^Choose a new password for QUOTA$/);
  expect(message.Text).toMatch(/24 hours/i);
  expect(message.Text).toMatch(/only once/i);
  const link = message.Text.match(/https?:\/\/[^\s]+\/reset-password\?token=[^\s]+/)?.[0];
  expect(link).toBeTruthy();
  return link;
}
async function submitReset(page, link, password, status) {
  await page.goto(link);
  await expect(page.getByRole('heading', { name: /Choose a new password/ })).toBeVisible();
  await page.getByLabel(/^New\ password\s*\*?$/).fill(password);
  await page.getByLabel(/^Repeat\ password\s*\*?$/).fill(password);
  return answer(page, '/auth/password-resets',
    () => page.getByRole('button', { name: 'Save password', exact: true }).click(), status);
}

test.describe('MH-07 Reserve for a hiker — definition scenarios', () => {
  test.setTimeout(60_000);
  test.beforeAll(async ({ request }) => {
    if (!process.env.E2E_DATABASE_URL || !mailpit || !process.env.SMTP_HOST || !process.env.SMTP_PORT) {
      throw new Error('MH-07 requires E2E_DATABASE_URL, MAILPIT_URL, SMTP_HOST and SMTP_PORT (dedicated database/Mailpit).');
    }
    if (process.env.NODE_ENV === 'test' && process.env.TEST_DATABASE_URL !== process.env.E2E_DATABASE_URL) {
      throw new Error('NODE_ENV=test makes the server use TEST_DATABASE_URL; it must equal E2E_DATABASE_URL.');
    }
    await mailboxTotal(request);
    const { Pool } = requireServer('pg');
    pool = new Pool({ connectionString: process.env.E2E_DATABASE_URL });
    const { hash } = await import('../../server/src/passwordHasher.js');
    passwordHash = await hash(PASSWORD);
  });
  test.beforeEach(async () => { await createFixture(); });
  test.afterEach(async ({ page }) => {
    try {
      await page.close();
    } finally {
      await cleanupFixture();
    }
  });
  test.afterAll(async () => { await pool?.end(); });

  test('S1: employee access; visitors and hikers denied without creating data', async ({ page, browser, baseURL }) => {
    await openStaff(page);
    const hiker = await createUser();
    const before = await dataCounts();
    await login(page, hiker);
    await page.goto(ROUTE);
    await expect(page.getByRole('heading', { name: 'Staff only', exact: true })).toBeVisible();
    expect((await page.request.get('/api/staff/hikers?q=someone')).status()).toBe(403);
    const visitor = await browser.newContext({ baseURL, timezoneId: zone });
    try {
      const tab = await visitor.newPage();
      await tab.goto(ROUTE);
      await expect(tab).toHaveURL(/\/login(?:[/?#]|$)/);
      expect((await visitor.request.get('/api/staff/hikers?q=someone')).status()).toBe(401);
    } finally {
      await visitor.close();
    }
    expect(await dataCounts()).toEqual(before);
  });

  test('S2: search name/phone/email; exclude temporary/staff; gate controls and limit results', async ({ page }) => {
    const sharedName = 'Search' + fixture.prefix;
    const regular = await createUser(sharedName);
    const temporary = await createUser(sharedName, { temporary: true });
    const employee = await createUser(sharedName, { role: 'EMPLOYEE' });
    const warden = await createUser(sharedName, { role: 'WARDEN' });
    await openStaff(page);
    await expectLocked(page);
    const searchBox = page.getByRole('searchbox', { name: 'Find the hiker', exact: true });
    await expect(searchBox).toHaveAttribute('placeholder', 'Name, phone or email');
    const shortRequests = [];
    page.on('request', (r) => {
      const url = new URL(r.url());
      if (url.pathname === '/api/staff/hikers' && (url.searchParams.get('q') ?? '').trim().length < 2) shortRequests.push(r);
    });
    await searchBox.fill('S');
    await page.waitForTimeout(1000); // Negative observation, longer than ordinary search debounce.
    expect(shortRequests).toHaveLength(0);
    await expect(results(page).getByRole('radio')).toHaveCount(0);

    // Exercise the exact two-character threshold as well as complete field matches.
    const twoCharacters = await search(page, fixture.prefix.slice(0, 2));
    expect(twoCharacters.map((row) => row.id)).toContain(regular.id);
    expect(twoCharacters.some((row) => [temporary.id, employee.id, warden.id].includes(row.id))).toBe(false);
    await expect(hikerOption(page, regular)).toBeVisible();

    const counts = await dataCounts();
    for (const query of [sharedName, regular.phone, regular.email]) {
      const rows = await search(page, query);
      expect(rows.map((row) => row.id)).toEqual([regular.id]);
      const option = hikerOption(page, regular);
      await expect(option).toContainText(regular.email);
      await expect(option).toContainText(regular.phone);
      for (const excluded of [temporary, employee, warden]) {
        await expect(hikerOption(page, excluded)).toHaveCount(0);
      }
      await option.click();
      await expect(summary(page)).toContainText(fullName(regular));
      await expect(dayChoice(page)).toBeEnabled();
      await expect(page.getByRole('button', { name: 'One more', exact: true })).toBeEnabled();
      await chooseDayAndPeople(page, 2);
      await expect(timeChoice(page)).toBeEnabled();
      await page.getByRole('button', { name: 'Change', exact: true }).click();
      await expect(searchBox).toBeVisible();
      await expectLocked(page);
    }
    expect(await dataCounts()).toEqual(counts);

    for (let n = 0; n < 21; n += 1) await createUser(sharedName);
    const waiting = page.waitForResponse((r) => matches(r, '/staff/hikers', 'GET') &&
      new URL(r.url()).searchParams.get('q') === sharedName);
    await pendingAction(page, '/staff/hikers?*', () => searchBox.fill(sharedName), searchBox, null, true);
    const response = await waiting;
    expect(response.status()).toBe(200);
    const rows = await response.json();
    expect(rows).toHaveLength(20);
    expect(rows.every((row) => row.temporary === false)).toBe(true);
    expect(rows.some((row) => [temporary.id, employee.id, warden.id].includes(row.id))).toBe(false);
    await expect(results(page).getByRole('radio')).toHaveCount(20);
    expect(shortRequests).toHaveLength(0);
  });

  test('S3: quick entry selects a temporary hiker without account email', async ({ page, request }) => {
    await openStaff(page);
    const beforeMail = await mailboxTotal(request);
    const hiker = await addHiker(page, false, true);
    await expect(summary(page)).not.toContainText(/[^\s@]+@[^\s@]+\.[^\s@]+/);
    expect(await get('SELECT email,password_hash AS hash,temporary FROM app_user WHERE id=$1', [hiker.id]))
      .toEqual({ email: null, hash: null, temporary: true });
    await expect(dayChoice(page)).toBeEnabled();
    await chooseDayAndPeople(page, 1);
    await expect(timeChoice(page)).toBeEnabled();
    expect(await bookingCount()).toBe(0);
    await noMail(request, beforeMail);
  });

  test('S4: full profile sends one complete account email and persists without a booking', async ({ page, request }) => {
    await openStaff(page);
    const hiker = await addHiker(page);
    const message = await messageBySubject(request, hiker.email, /^Your QUOTA account$/);
    expect(expectAccountEmail(message, hiker)).toBe(hiker.password);
    await exactMail(request, hiker.email, 1);
    await page.goto('/');
    await page.reload();
    expect(await get('SELECT temporary,must_change_password AS required FROM app_user WHERE id=$1', [hiker.id]))
      .toEqual({ temporary: false, required: true });
    expect(await bookingCount()).toBe(0);
    await openStaff(page);
    await chooseHiker(page, hiker);
  });

  for (const finish of ['Done', '+ New reservation']) {
    test('S5: existing hiker booking, complete confirmation, and ' + finish, async ({ page, request }) => {
      const hiker = await createUser();
      expect(await recipientMessages(request, hiker.email)).toEqual([]);
      await openStaff(page);
      await chooseHiker(page, hiker);
      const preview = await chooseSlot(page, 2);
      const booking = await save(page, hiker, preview, true);
      const message = await messageBySubject(request, hiker.email, /^Your table is booked/);
      expectConfirmation(message, hiker, booking);
      await exactMail(request, hiker.email, 1);
      const dialog = page.getByRole('dialog', { name: 'Reservation saved', exact: true });
      await dialog.getByRole('button', { name: finish, exact: true }).click();
      await expect(dialog).toBeHidden();
      if (finish === '+ New reservation') {
        await expect(page.getByRole('searchbox', { name: 'Find the hiker', exact: true })).toHaveValue('');
        await expect(summary(page)).not.toContainText(fullName(hiker));
        await expectLocked(page);
        await expect(page.getByRole('radiogroup', { name: 'Time', exact: true }).getByRole('radio', { checked: true })).toHaveCount(0);
      }
    });
  }

  test('S6: temporary party of three; no mail, password, login or public booking', async ({ page, request, browser, baseURL }) => {
    await openStaff(page);
    const beforeMail = await mailboxTotal(request);
    const hiker = await addHiker(page, false);
    const preview = await chooseSlot(page, 3);
    await save(page, hiker, preview);
    expect(await get('SELECT email,password_hash AS hash FROM app_user WHERE id=$1', [hiker.id]))
      .toEqual({ email: null, hash: null });
    // Without an email/secret the temporary profile cannot obtain a login session.
    const publicContext = await browser.newContext({ baseURL });
    try {
      const denied = await publicContext.request.post('/api/auth/login', { data: { email: '', password: PASSWORD } });
      expect(denied.status()).toBe(400);
      expect((await publicContext.request.get('/api/auth/me')).status()).toBe(401);
      expect((await publicContext.request.post('/api/bookings', {
        data: { slotId: fixture.slot.slotId, partySize: 3, tables: preview.tables },
      })).status()).toBe(401);
    } finally {
      await publicContext.close();
    }
    expect(await bookingCount()).toBe(1);
    await noMail(request, beforeMail);
  });

  test('S7: staff books inside the public two-hour cutoff', async ({ page, request }) => {
    await moveSlot(30);
    const hiker = await createUser();
    const window = await get(
      'SELECT EXTRACT(EPOCH FROM ((service_date + starts_at) AT TIME ZONE $2 - clock_timestamp())) AS seconds FROM slot WHERE id=$1',
      [fixture.slot.slotId, zone],
    );
    expect(Number(window.seconds)).toBeGreaterThan(0);
    expect(Number(window.seconds)).toBeLessThan(7200);
    await openStaff(page);
    await chooseHiker(page, hiker);
    const preview = await chooseSlot(page);
    const booking = await save(page, hiker, preview);
    expectConfirmation(await messageBySubject(request, hiker.email, /^Your table is booked/), hiker, booking);
    await exactMail(request, hiker.email, 1);
  });

  test('S8: insufficient seats disable selection/save and create no booking or mail', async ({ page, request }) => {
    const hiker = await createUser();
    await openStaff(page);
    await chooseHiker(page, hiker);
    const beforeMail = await mailboxTotal(request);
    await chooseDayAndPeople(page, 9);
    await expect(timeChoice(page)).toBeVisible();
    await expect(timeChoice(page)).toBeDisabled();
    // Assert the capacity facts without requiring one invented explanation sentence.
    await expect(timeChoice(page)).toContainText(/\b8\b/);
    await expect(page.getByRole('group', { name: 'How many people', exact: true })).toContainText('9');
    await expect(page.getByText(/not enough|does not fit|cannot fit|can't fit|too (?:many|large)|need.*seats|only.*seats/i).first())
      .toBeVisible();
    await expect(saveButton(page)).toBeDisabled();
    expect(await bookingCount()).toBe(0);
    await noMail(request, beforeMail);
  });

  test('S9: duplicate yields 422, preserves choices, and creates no booking or mail', async ({ page, request }) => {
    const hiker = await createUser();
    await compete(hiker, [{ tableNumber: 1, seats: 1 }]);
    await openStaff(page);
    await chooseHiker(page, hiker);
    await chooseSlot(page, 2);
    const beforeMail = await mailboxTotal(request);
    await answer(page, '/staff/bookings', () => saveButton(page).click(), 422);
    await expect(page.getByRole('alert')).toContainText(/already.*booking/i);
    await expectChoices(page, hiker, 2);
    await expect(timeChoice(page)).toHaveAttribute('aria-checked', 'true');
    expect(await bookingCount(hiker.id)).toBe(1);
    await setPeople(page, 3);
    await noMail(request, beforeMail);
  });

  test('S10: duplicate emails give identical 409s; offer only the existing regular hiker', async ({ page, request }) => {
    const hiker = await createUser();
    await openStaff(page);
    const before = await dataCounts();
    const beforeMail = await mailboxTotal(request);
    const attempt = async (owner) => {
      const dialog = await openHikerDialog(page, 'Full profile');
      await fillHiker(dialog, { ...identity('Other'), email: owner.email }, true);
      const lookup = page.waitForResponse((r) => matches(r, '/staff/hikers', 'GET') &&
        new URL(r.url()).searchParams.get('q') === owner.email);
      const conflict = await answer(page, '/staff/hikers',
        () => dialog.getByRole('button', { name: 'Add hiker', exact: true }).click(), 409);
      const response = await lookup;
      expect(response.status()).toBe(200);
      return { dialog, conflict, found: await response.json() };
    };
    const first = await attempt(hiker);
    expect(first.found.map((row) => row.id)).toEqual([hiker.id]);
    await first.dialog.getByRole('button', { name: 'Choose ' + fullName(hiker), exact: true }).click();
    await expect(first.dialog).toBeHidden();
    await expect(summary(page)).toContainText(fullName(hiker));
    await page.getByRole('button', { name: 'Change', exact: true }).click();
    const second = await attempt(fixture.employee);
    expect(second.conflict).toEqual(first.conflict);
    expect(second.found).toEqual([]);
    await expect(second.dialog).toContainText(/email.*already.*use.*another email/i);
    await expect(second.dialog).not.toContainText(fullName(fixture.employee));
    await expect(second.dialog).not.toContainText(fixture.employee.phone);
    await expect(second.dialog).not.toContainText(/\bEMPLOYEE\b|\bWARDEN\b/);
    await expect(second.dialog.getByRole('button', { name: /^Choose / })).toHaveCount(0);
    expect(JSON.stringify(second.conflict)).not.toContain(fullName(fixture.employee));
    expect(JSON.stringify(second.conflict)).not.toContain(fixture.employee.phone);
    expect(await dataCounts()).toEqual(before);
    await noMail(request, beforeMail);
  });

  test('S11: slot starts after preview; 422 refreshes times and preserves hiker/day/people', async ({ page, request }) => {
    await moveSlot(30);
    const displayedSlot = { ...fixture.slot };
    const hiker = await createUser();
    await openStaff(page);
    await chooseHiker(page, hiker);
    await chooseSlot(page, 2);
    await moveSlot(-1);
    const beforeMail = await mailboxTotal(request);
    await answer(page, '/staff/slots/' + fixture.slot.slotId + '/seating', () => saveButton(page).click(), 422, 'GET');
    await expect(page.getByRole('alert')).toContainText('This time has already started. Choose another time.');
    await expectChoices(page, hiker, 2, displayedSlot);
    await expect(saveButton(page)).toBeDisabled();
    // A refresh must discard the old interval, not just disable its stale label.
    // The expired slot may be omitted, especially if it moved off the selected date.
    await expect(timeChoice(page, displayedSlot)).toHaveCount(0);
    if (await timeChoice(page).count()) await expect(timeChoice(page)).toBeDisabled();
    expect(await bookingCount()).toBe(0);
    await noMail(request, beforeMail);
  });

  test('S12: emailed password forces change before protected booking access', async ({ page, request }) => {
    await openStaff(page);
    const hiker = await addHiker(page);
    const generated = expectAccountEmail(await messageBySubject(request, hiker.email, /^Your QUOTA account$/), hiker);
    expect((await login(page, { ...hiker, password: generated })).mustChangePassword).toBe(true);
    await page.goto('/book');
    await expect(page).toHaveURL(/\/change-password(?:[/?#]|$)/);
    const blocked = await page.request.get('/api/bookings');
    expect(blocked.status()).toBe(403);
    expect(await blocked.json()).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });
    await page.getByLabel(/^Current\ password\s*\*?$/).fill(generated);
    await page.getByLabel(/^New\ password\s*\*?$/).fill('chosen-password-2026');
    await page.getByLabel(/^Repeat\ password\s*\*?$/).fill('chosen-password-2026');
    await answer(page, '/auth/change-password',
      () => page.getByRole('button', { name: 'Save and continue', exact: true }).click(), 204);
    await page.goto('/book');
    await expect(page.getByRole('heading', { name: 'Book a table', exact: true })).toBeVisible();
    expect((await page.request.get('/api/bookings')).status()).toBe(200);
    expect((await accountState(hiker.id)).required).toBe(false);
    expect((await page.request.post('/api/auth/login', { data: { email: hiker.email, password: generated } })).status()).toBe(401);
  });

  test('S13: recover a staff-created account via Forgot password; token works once', async ({ page, request }) => {
    await openStaff(page);
    const hiker = await addHiker(page);
    await exactMail(request, hiker.email, 1);
    expect((await accountState(hiker.id)).required).toBe(true);
    await page.request.post('/api/auth/logout');
    const link = await resetLink(page, request, hiker);
    await submitReset(page, link, 'reset-password-2026', 204);
    await expect(page).toHaveURL(/\/login(?:[/?#]|$)/);
    await login(page, { ...hiker, password: 'reset-password-2026' });
    expect((await page.request.get('/api/bookings')).status()).toBe(200);
    const changed = await accountState(hiker.id);
    expect(changed.required).toBe(false);
    expect(await submitReset(page, link, 'another-password-2026', 422)).toMatchObject({ code: 'RESET_LINK_NOT_VALID' });
    await expect(page.getByRole('heading', { name: /This link no longer works/ })).toBeVisible();
    expect(await accountState(hiker.id)).toEqual(changed);
  });

  test('S14: expired reset preserves the old password and never consumes the token', async ({ page, request }) => {
    const hiker = await createUser();
    expect(await recipientMessages(request, hiker.email)).toEqual([]);
    const before = await accountState(hiker.id);
    const link = await resetLink(page, request, hiker);
    await pool.query("UPDATE password_reset SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1", [hiker.id]);
    expect(await submitReset(page, link, 'expired-password-2026', 422)).toMatchObject({ code: 'RESET_LINK_NOT_VALID' });
    await expect(page.getByRole('heading', { name: /This link no longer works/ })).toBeVisible();
    expect(await accountState(hiker.id)).toEqual(before);
    expect(await get('SELECT used_at FROM password_reset WHERE user_id=$1', [hiker.id])).toEqual({ used_at: null });
    await login(page, hiker);
    expect((await page.request.post('/api/auth/login', { data: { email: hiker.email, password: 'expired-password-2026' } })).status()).toBe(401);
  });

  for (const code of ['NO_SEATS', 'TABLES_CHANGED']) {
    test('S15: real competing booking causes ' + code + '; no reservation or email for rejected hiker', async ({ page, request }) => {
      const hiker = await createUser();
      const other = await createUser('Competing');
      await openStaff(page);
      await chooseHiker(page, hiker);
      const preview = await chooseSlot(page, 3);
      // Intercept the real booking only to create a genuine race AFTER its seating preview.
      // A changed allocation is retried once by the UI; exhaust that retry with another booking.
      let attempts = 0;
      const statuses = [];
      page.on('response', (r) => { if (matches(r, '/staff/bookings')) statuses.push(r.status()); });
      await page.route('**/api/staff/bookings', async (route) => {
        attempts += 1;
        const body = route.request().postDataJSON();
        const rival = attempts === 1 ? other : await createUser('SecondCompeting');
        const taken = code === 'NO_SEATS'
          ? fixture.tables.map((t) => ({ tableNumber: t.tableNumber, seats: t.capacity }))
          : body.tables.map((t) => ({ tableNumber: t.tableNumber, seats: 4 }));
        await compete(rival, taken);
        expect(await bookingCount(hiker.id)).toBe(0);
        await route.continue();
      });
      const beforeMail = await mailboxTotal(request);
      const refused = await answer(page, '/staff/bookings', () => saveButton(page).click(), 409);
      expect(refused).toMatchObject({ code });
      await expect(page.getByRole('alert').filter({ hasText: /seats were just taken/ })).toBeVisible();
      await expectChoices(page, hiker, 3);
      await expect(saveButton(page)).toBeDisabled();
      await expect(timeChoice(page)).toBeDisabled();
      await expect(timeChoice(page)).toContainText('Full');
      expect(attempts).toBe(code === 'NO_SEATS' ? 1 : 2);
      expect(statuses).toEqual(code === 'NO_SEATS' ? [409] : [409, 409]);
      expect(await bookingCount(hiker.id)).toBe(0);
      await setPeople(page, 2);
      await noMail(request, beforeMail);
      expect(await bookingCount(hiker.id)).toBe(0);
    });
  }

  test('S16: invalid quick/full fields preserve valid values and send no creation request or mail', async ({ page, request }) => {
    await openStaff(page);
    const before = await dataCounts();
    const beforeMail = await mailboxTotal(request);
    let writes = 0;
    page.on('request', (r) => {
      if (r.method() === 'POST' && ['/api/staff/hikers', '/api/staff/bookings'].includes(new URL(r.url()).pathname)) writes += 1;
    });
    const person = identity('Valid');
    const dialog = await openHikerDialog(page, 'Quick entry');
    const submit = () => dialog.getByRole('button', { name: 'Add hiker', exact: true }).click();
    await submit();
    await expect(dialog.getByText(/Enter the first name/)).toBeVisible();
    await expect(dialog.getByText(/Enter the last name/)).toBeVisible();
    await fillHiker(dialog, { ...person, phone: 'not-a-phone' }, false);
    await submit();
    await expect(dialog.getByText(/Enter a valid phone number/)).toBeVisible();
    await expect(dialog.getByLabel(/^First\ name\s*\*?$/)).toHaveValue(person.firstName);
    await expect(dialog.getByLabel(/^Last\ name\s*\*?$/)).toHaveValue(person.lastName);
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/^Phone\s*\*?$/).fill(person.phone);
    await selectHikerType(dialog, 'Full profile');
    await dialog.getByLabel(/^Email\s*\*?$/).fill('');
    await submit();
    await expect(dialog.getByText(/Enter a valid email/)).toBeVisible();
    await dialog.getByLabel(/^Email\s*\*?$/).fill('malformed-email');
    await submit();
    await expect(dialog.getByText(/Enter a valid email/)).toBeVisible();
    await dialog.getByLabel(/^Email\s*\*?$/).fill(person.email);
    await dialog.getByLabel(/^Phone\s*\*?$/).fill('another-invalid-phone');
    await submit();
    await expect(dialog.getByText(/Enter a valid phone number/)).toBeVisible();
    await expect(dialog.getByLabel(/^First\ name\s*\*?$/)).toHaveValue(person.firstName);
    await expect(dialog.getByLabel(/^Last\ name\s*\*?$/)).toHaveValue(person.lastName);
    await expect(dialog.getByLabel(/^Email\s*\*?$/)).toHaveValue(person.email);
    await expect(dialog).toBeVisible();
    await noMail(request, beforeMail);
    expect(writes).toBe(0);
    expect(await dataCounts()).toEqual(before);
  });

  test('S17: account email precedes saving; separate complete booking email follows', async ({ page, request }) => {
    await openStaff(page);
    const hiker = await addHiker(page);
    const account = await messageBySubject(request, hiker.email, /^Your QUOTA account$/);
    expectAccountEmail(account, hiker);
    await exactMail(request, hiker.email, 1);
    expect(await bookingCount()).toBe(0);
    const preview = await chooseSlot(page, 2);
    const booking = await save(page, hiker, preview);
    const confirmation = await messageBySubject(request, hiker.email, /^Your table is booked/);
    expectConfirmation(confirmation, hiker, booking);
    await exactMail(request, hiker.email, 2);
    expect(confirmation.ID).not.toBe(account.ID);
  });
});
