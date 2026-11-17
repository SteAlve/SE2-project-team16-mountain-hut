// MH-06, Phase 2: docs/e2e-definitions/MH-6-change-booking-e2e-scenarios.md.
// Real browser, API, PostgreSQL and Mailpit. Fixtures use the real booking DAO, so
// creating a fixture does not send a booking-confirmation email. Mail assertions
// nevertheless correlate recipient, reference and the exact change-email subject.
// Scenario 9 stays in server/test/usecases/changeBooking.test.js: both original
// and destination exact 48-hour boundaries and T + 1 ms use an injected clock.
import { randomUUID } from 'node:crypto';
import { expect, test as base } from '@playwright/test';

if (process.env.E2E_DATABASE_URL) process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
const { config } = await import('../../server/src/config.js');
const { all, close, get, inTransaction, run } = await import('../../server/src/dao/db.js');
const bookings = await import('../../server/src/dao/bookings.js');
const slots = await import('../../server/src/dao/slots.js');

const PASSWORD = 'quota-e2e-mh06';
const MAILPIT = process.env.MAILPIT_URL;
const ZONE = 'Europe/Rome';
const reference = (id) => `QUOTA-${String(id).padStart(5, '0')}`;
const need = (values = {}) => ({
  diets: [], allergies: [], otherDiet: null, otherAllergy: null, otherRequests: null, ...values,
});
const VEGAN = need({ diets: ['VEGAN'] });
const dayParts = (date, options) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', options)
  .formatToParts(date).map(({ type, value }) => [type, value]));
const romeDay = (offset = 0) => {
  const p = dayParts(new Date(Date.now() + offset * 86400000), {
    timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return `${p.year}-${p.month}-${p.day}`;
};
const dayName = (date) => {
  const p = dayParts(new Date(`${date}T12:00:00Z`), {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short',
  });
  return `${p.weekday} ${p.day} ${p.month}`;
};
const emailDay = (date) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date(`${date}T12:00:00Z`));
const emailMoment = (instant) => {
  const p = dayParts(new Date(instant), {
    timeZone: ZONE, day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
};

async function messages(api, address) {
  const response = await api.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:"${address}"` } });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).messages;
}
async function changeEmails(api, owner, booking) {
  return (await messages(api, owner.email))
    .filter(({ Subject }) => Subject === `Your booking has changed (${reference(booking.id)})`);
}

const test = base.extend({
  scenario: async ({ request }, use) => {
    const f = { api: request, slotIds: [], setIds: [], emails: [], dates: [] };
    try {
      // Consecutive empty future days keep both destinations in the initial day strip,
      // without deleting other stories' slots or relying on demo data.
      for (let offset = 4; offset < 60 && f.dates.length < 2; offset += 1) {
        const dates = [romeDay(offset), romeDay(offset + 1)];
        if (!(await get('SELECT 1 FROM slot WHERE service_date = ANY($1::DATE[])', [dates]))) f.dates.push(...dates);
      }
      expect(f.dates, 'Two empty future fixture days').toHaveLength(2);
      await use(f);
    } finally {
      await inTransaction(async () => {
        await run('DELETE FROM booking WHERE slot_id = ANY($1::INTEGER[])', [f.slotIds]);
        await run('DELETE FROM slot WHERE id = ANY($1::INTEGER[])', [f.slotIds]);
        await run('DELETE FROM hut_table WHERE table_set_id = ANY($1::INTEGER[])', [f.setIds]);
        await run('DELETE FROM table_set WHERE id = ANY($1::INTEGER[])', [f.setIds]);
        await run('DELETE FROM app_user WHERE email = ANY($1::TEXT[])', [f.emails]);
      });
      const ownMessages = (await Promise.all(f.emails.map((email) => messages(f.api, email)))).flat();
      if (ownMessages.length) {
        // Mailpit interprets an empty IDs array as "delete all": never send one.
        const removed = await f.api.delete(`${MAILPIT}/api/v1/messages`, {
          data: { IDs: ownMessages.map(({ ID }) => ID) },
        });
        expect(removed.ok(), await removed.text()).toBeTruthy();
      }
    }
  },
});

test.beforeAll(async ({ request }) => {
  expect(process.env.E2E_DATABASE_URL, 'Set E2E_DATABASE_URL to a dedicated E2E database').toBeTruthy();
  expect(config.databaseUrl).toBe(process.env.E2E_DATABASE_URL);
  expect(new URL(config.databaseUrl).pathname, 'Do not use the development database').not.toBe('/mountain_hut');
  expect(MAILPIT, 'Set MAILPIT_URL and route backend SMTP to Mailpit; email checks are mandatory').toBeTruthy();
  expect((await request.get(`${MAILPIT}/api/v1/info`)).ok(), 'Mailpit must be available').toBeTruthy();
});
test.afterAll(async () => { await close(); });

async function hiker(f, api) {
  const email = `e2e-mh06-${randomUUID()}@example.com`;
  f.emails.push(email); // Track before the HTTP assertion, including failed registrations.
  const profile = { firstName: 'Mara', lastName: 'Rossi', email, password: PASSWORD };
  const response = await api.post('/api/auth/register', { data: profile });
  expect(response.status(), await response.text()).toBe(201);
  const row = await get('SELECT id FROM app_user WHERE email = $1', [email]);
  return { ...profile, id: row.id, api };
}

async function slot(f, { date = f.dates[0], startsAt = '12:00', endsAt = '13:00', capacities = [6] } = {}) {
  return inTransaction(async () => {
    const set = await get('INSERT INTO table_set (name) VALUES ($1) RETURNING id', [`E2E MH-06 ${randomUUID()}`]);
    f.setIds.push(set.id);
    const tables = [];
    for (const [i, capacity] of capacities.entries()) {
      tables.push(await get(`INSERT INTO hut_table (table_set_id, table_number, seat_capacity)
        VALUES ($1, $2, $3) RETURNING id, table_number AS "tableNumber", seat_capacity AS capacity`,
      [set.id, i + 1, capacity]));
    }
    const row = await get(`INSERT INTO slot (service_date, starts_at, ends_at, table_set_id)
      VALUES ($1, $2, $3, $4) RETURNING id`, [date, startsAt, endsAt, set.id]);
    f.slotIds.push(row.id);
    return { slotId: row.id, date, startsAt, endsAt, tables };
  });
}

async function book(owner, meal, { partySize = 4, requirements = [VEGAN], assignments } = {}) {
  let left = partySize;
  const allocated = assignments ?? meal.tables.flatMap((table) => {
    const seats = Math.min(left, table.capacity);
    left -= seats;
    return seats ? [{ tableNumber: table.tableNumber, seats }] : [];
  });
  const saved = await bookings.createWithTableAssignments({
    hikerId: owner.id, slotId: meal.slotId, partySize, requirements,
    tableAssignments: allocated.map(({ tableNumber, seats }) => ({
      tableId: meal.tables.find((table) => table.tableNumber === tableNumber).id, seatCount: seats,
    })),
  });
  return bookings.findById(saved.id);
}

async function setup(f, page, options = {}) {
  const owner = await hiker(f, page.request); // Registration establishes the browser's real session.
  const meal = await slot(f, options);
  const booking = await book(owner, meal, options);
  return { owner, meal, booking, before: await stored(booking.id), observed: observe(page, booking.id) };
}

async function stored(id) {
  return {
    booking: await get('SELECT * FROM booking WHERE id = $1', [id]),
    assignments: await all('SELECT * FROM booking_table WHERE booking_id = $1 ORDER BY hut_table_id', [id]),
    requirements: await all('SELECT * FROM booking_requirement WHERE booking_id = $1 ORDER BY id', [id]),
  };
}
const free = async (meal) => (await slots.findAvailableTablesBySlotId(meal.slotId))
  .reduce((sum, table) => sum + table.freeSeats, 0);
const card = (page, booking) => page.getByRole('listitem', { name: `Booking ${reference(booking.id)}`, exact: true });
const editor = (page) => page.getByRole('dialog', { name: /^Change your booking/ });
const popup = (page) => page.getByRole('dialog', { name: /^(Add|Edit) a guest['’]s needs$/ });
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const times = (page) => editor(page).getByRole('radiogroup', { name: 'Time', exact: true });
const timeRadio = (page, startsAt) => times(page).getByRole('radio', { name: new RegExp(`^${startsAt.slice(0, 5)}`) });
const needsSection = (page) => editor(page).getByRole('region', { name: 'Dietary needs and allergies' });

function observe(page, id) {
  const observed = { patches: [], previews: [] };
  page.on('request', (req) => {
    const path = new URL(req.url()).pathname;
    if (req.method() === 'PATCH' && path === `/api/bookings/${id}`) observed.patches.push(req.postDataJSON());
    if (/\/api\/slots\/\d+\/seating$/.test(path)) observed.previews.push(path);
  });
  return observed;
}
const responseFor = (page, path, method = 'GET') => page.waitForResponse((r) =>
  new URL(r.url()).pathname === path && r.request().method() === method);

async function openBookings(page, booking) {
  const loaded = responseFor(page, '/api/bookings');
  await page.goto('/bookings');
  expect((await loaded).status()).toBe(200);
  await expect(card(page, booking)).toBeVisible();
}
async function openEditor(page, booking) {
  await button(card(page, booking), 'Edit').click();
  await expect(editor(page)).toHaveAccessibleName(`Change your booking ${reference(booking.id)}`);
  await expect(timeRadio(page, booking.startsAt)).toHaveAttribute('aria-checked', 'true');
}
async function chooseDay(page, date) {
  const radio = editor(page).getByRole('radiogroup', { name: 'Day', exact: true })
    .getByRole('radio', { name: dayName(date), exact: true });
  await radio.click();
  await expect(radio).toHaveAttribute('aria-checked', 'true');
}
async function chooseTime(page, startsAt) {
  await timeRadio(page, startsAt).click();
  await expect(timeRadio(page, startsAt)).toHaveAttribute('aria-checked', 'true');
}
async function party(page, from, to) {
  const group = editor(page).getByRole('group', { name: 'How many people', exact: true });
  for (let i = 0; i < Math.abs(to - from); i += 1) await button(group, to > from ? 'One more' : 'One fewer').click();
  await expect(group.getByRole('status')).toHaveText(String(to));
}
async function openNeeds(page, line) {
  await button(editor(page), line ? `Edit line ${line}` : /^\+\s+Add a guest's needs$/).click();
  await expect(popup(page)).toHaveAccessibleName(line ? 'Edit a guest’s needs' : 'Add a guest’s needs');
}
async function dismissNeeds(page, method) {
  if (method === 'Esc') await page.keyboard.press('Escape');
  else await button(popup(page), method).click();
  await expect(popup(page)).toHaveCount(0);
  await expect(editor(page)).toBeVisible();
}
async function list(owner) {
  const response = await owner.api.get('/api/bookings');
  expect(response.status()).toBe(200);
  return response.json();
}
async function noChange(f, t) {
  expect(t.observed.patches).toEqual([]);
  expect(await stored(t.booking.id)).toEqual(t.before);
  expect(await changeEmails(f.api, t.owner, t.booking)).toEqual([]);
}
async function save(page, t, payload, status = 200, stale = false) {
  const answer = responseFor(page, `/api/bookings/${t.booking.id}`, 'PATCH');
  const reload = status === 200 || status === 422 || stale ? responseFor(page, '/api/bookings') : null;
  const started = Date.now();
  await button(editor(page), 'Save changes').click();
  const response = await answer;
  expect(response.status(), await response.text()).toBe(status);
  if (reload) expect((await reload).status()).toBe(200);
  expect(t.observed.patches).toEqual([payload]);
  expect(t.observed.previews).toEqual([]);
  if (status === 200 || stale) await expect(editor(page)).toHaveCount(0);
  else await expect(editor(page)).toBeVisible();
  return { body: await response.json(), started, finished: Date.now() };
}
async function persisted(page, t, expected) {
  const apiExpected = Object.fromEntries(['id', 'date', 'slotId', 'partySize', 'tables', 'requirements']
    .filter((key) => expected[key] !== undefined).map((key) => [key, expected[key]]));
  for (const key of ['startsAt', 'endsAt']) if (expected[key] !== undefined) apiExpected[key] = expected[key].slice(0, 5);
  const fromApi = (await list(t.owner)).find(({ id }) => id === t.booking.id);
  expect(fromApi).toMatchObject(apiExpected);
  const loaded = responseFor(page, '/api/bookings');
  await page.reload();
  expect((await loaded).status()).toBe(200);
  await expect(card(page, t.booking)).toContainText(`${expected.partySize} people`);
  await expect(card(page, t.booking)).toContainText(dayName(expected.date));
  await expect(card(page, t.booking)).toContainText(expected.startsAt.slice(0, 5));
  expect((await list(t.owner)).find(({ id }) => id === t.booking.id)).toMatchObject(apiExpected);
}
async function changedEmail(f, t, booking, interval) {
  let found;
  await expect.poll(async () => {
    found = await changeEmails(f.api, t.owner, t.booking);
    return found.length;
  }, { timeout: 10_000, message: 'Exactly one change email for this recipient and reference' }).toBe(1);
  const response = await f.api.get(`${MAILPIT}/api/v1/message/${found[0].ID}`);
  expect(response.ok()).toBeTruthy();
  const email = await response.json();
  expect(email.To.map(({ Address }) => Address)).toEqual([t.owner.email]);
  expect(email.Subject).toBe(`Your booking has changed (${reference(t.booking.id)})`);
  for (const [label, value] of [
    ['Booking reference', reference(t.booking.id)], ['Name', 'Mara Rossi'], ['Date', emailDay(booking.date)],
    ['Time', `${booking.startsAt.slice(0, 5)}–${booking.endsAt.slice(0, 5)}`], ['Party size', String(booking.partySize)],
  ]) {
    expect(email.Text).toContain(`${label}: ${value}`);
    expect(email.HTML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')).toContain(`${label} ${value}`);
  }
  expect(email.Text).toContain('These details replace the ones of the earlier emails');
  const possible = new Set();
  for (let ms = Math.floor(interval.started / 60000) * 60000; ms <= interval.finished; ms += 60000) possible.add(emailMoment(ms));
  expect([...possible]).toContain(email.Text.match(/Changed on: (.+)/)[1].trim());
  expect(email.HTML).toContain(email.Text.match(/Changed on: (.+)/)[1].trim());
  return email;
}

test.describe('MH-06 — draft dialogs (Scenario 1)', () => {
  for (const method of ['Cancel', 'Esc']) {
    test(`${method} restores guest drafts; main Close discards all unsaved choices`, async ({ page, scenario: f }) => {
      const t = await setup(f, page);
      await openBookings(page, t.booking);
      await openEditor(page, t.booking);
      await expect(editor(page).getByRole('radiogroup', { name: 'Day', exact: true })
        .getByRole('radio', { name: dayName(t.meal.date), exact: true })).toHaveAttribute('aria-checked', 'true');
      await expect(button(editor(page), 'Save changes')).toBeDisabled();
      await party(page, 4, 5);
      await openNeeds(page, 1);
      const diet = popup(page).getByRole('group', { name: 'Diet', exact: true });
      await expect(button(diet, 'Vegan')).toHaveAttribute('aria-pressed', 'true');
      await button(diet, 'Vegetarian').click();
      await dismissNeeds(page, method);
      await expect(needsSection(page)).toContainText('Vegan');
      await expect(needsSection(page)).not.toContainText('Vegetarian');
      await openNeeds(page);
      await button(popup(page).getByRole('group', { name: 'Allergies', exact: true }), 'Peanuts').click();
      await dismissNeeds(page, method);
      await expect(button(editor(page), 'Edit line 2')).toHaveCount(0);
      await expect(needsSection(page)).toContainText('1 of 5');
      await openNeeds(page, 1);
      await popup(page).getByLabel('Anything else the kitchen should know?', { exact: true }).fill('Local draft only');
      await dismissNeeds(page, 'Done');
      await noChange(f, t);
      await openNeeds(page, 1);
      await expect(popup(page).getByLabel('Anything else the kitchen should know?', { exact: true })).toHaveValue('Local draft only');
      await dismissNeeds(page, 'Done');
      await button(editor(page), 'Close').click();
      await expect(editor(page)).toHaveCount(0);
      await persisted(page, t, t.booking);
      await openEditor(page, t.booking);
      await expect(editor(page).getByRole('group', { name: 'How many people', exact: true }).getByRole('status')).toHaveText('4');
      await openNeeds(page, 1);
      await expect(popup(page).getByLabel('Anything else the kitchen should know?', { exact: true })).toHaveValue('');
      await dismissNeeds(page, 'Cancel');
      await noChange(f, t);
    });
  }
});

test.describe('MH-06 — day, time and allocation (Scenarios 2–4)', () => {
  for (const variant of ['day', 'time']) {
    test(`changes only the ${variant}, preserving the reference and releasing the original seats`, async ({ page, scenario: f }) => {
      const t = await setup(f, page, { capacities: [4] });
      const destination = await slot(f, variant === 'day'
        ? { date: f.dates[1], capacities: [2, 2] }
        : { startsAt: '18:00', endsAt: '19:00', capacities: [2, 2] });
      expect(await free(t.meal)).toBe(0);
      await openBookings(page, t.booking);
      await openEditor(page, t.booking);
      if (variant === 'day') await chooseDay(page, destination.date);
      else await chooseTime(page, destination.startsAt);
      await expect(timeRadio(page, destination.startsAt)).toHaveAttribute('aria-checked', 'true');
      const result = await save(page, t, { slotId: destination.slotId });
      const expected = { ...t.booking, ...destination, id: t.booking.id,
        tables: [{ tableNumber: 1, seats: 2 }, { tableNumber: 2, seats: 2 }] };
      await persisted(page, t, {
        id: expected.id, date: expected.date, startsAt: expected.startsAt, endsAt: expected.endsAt,
        slotId: expected.slotId, partySize: 4, tables: expected.tables, requirements: t.booking.requirements,
      });
      expect(await free(t.meal)).toBe(4);
      expect(await free(destination)).toBe(0);
      await changedEmail(f, t, expected, result);
    });
  }

  for (const variant of ['missing', 'Full', 'ineligible']) {
    test(`date fallback leaves no time selected when the matching time is ${variant}`, async ({ page, scenario: f }) => {
      const t = await setup(f, page);
      const alternative = await slot(f, { date: f.dates[1], startsAt: '18:00', endsAt: '19:00' });
      let matching;
      if (variant !== 'missing') matching = await slot(f, { date: alternative.date, capacities: [4] });
      if (variant === 'Full') {
        const other = await hiker(f, f.api);
        await book(other, matching, { requirements: [] });
      }
      if (variant === 'ineligible') {
        // This controls only client filtering, comfortably on either side of its cutoff.
        // It is not a server-clock or exact 48-hour-boundary assertion (Scenario 9).
        const browserDay = new Date(`${alternative.date}T12:00:00Z`);
        browserDay.setUTCDate(browserDay.getUTCDate() - 2);
        await page.clock.setSystemTime(browserDay); // 13:00/14:00 at the hut: 12:00 excluded, 18:00 eligible.
      }
      await openBookings(page, t.booking);
      await openEditor(page, t.booking);
      await chooseDay(page, alternative.date);
      await expect(times(page).getByRole('radio', { checked: true })).toHaveCount(0);
      await expect(button(editor(page), 'Save changes')).toBeDisabled();
      if (variant === 'Full') {
        await expect(timeRadio(page, matching.startsAt)).toBeDisabled();
        await expect(timeRadio(page, matching.startsAt)).toContainText('Full');
      } else {
        await expect(timeRadio(page, t.meal.startsAt)).toHaveCount(0);
      }
      await chooseTime(page, alternative.startsAt);
      await expect(button(editor(page), 'Save changes')).toBeEnabled();
      await button(editor(page), 'Close').click();
      await persisted(page, t, t.booking);
      await noChange(f, t);
    });
  }

  test('increases 4 to 6 and moves from partly occupied table A to table C', async ({ page, scenario: f }) => {
    // The two physical tables are numbered 1 (A) and 2 (C) in this isolated fixture.
    const t = await setup(f, page, { capacities: [6, 6] });
    const other = await hiker(f, f.api);
    const otherBooking = await book(other, t.meal, {
      partySize: 2, requirements: [], assignments: [{ tableNumber: 1, seats: 2 }],
    });
    const otherBefore = await stored(otherBooking.id);
    await openBookings(page, t.booking);
    await openEditor(page, t.booking);
    await party(page, 4, 6);
    const result = await save(page, t, { partySize: 6 });
    const expected = { ...t.booking, partySize: 6, tables: [{ tableNumber: 2, seats: 6 }] };
    await persisted(page, t, { partySize: 6, date: t.meal.date, startsAt: t.meal.startsAt,
      tables: expected.tables, requirements: t.booking.requirements, slotId: t.meal.slotId });
    expect(await slots.findAvailableTablesBySlotId(t.meal.slotId)).toEqual([
      { tableId: t.meal.tables[0].id, tableNumber: 1, seatCapacity: 6, freeSeats: 4 },
    ]);
    expect(await stored(otherBooking.id)).toEqual(otherBefore);
    await changedEmail(f, t, expected, result);
  });

  test('decreases 4 to 2 and releases the two unused seats', async ({ page, scenario: f }) => {
    const t = await setup(f, page, { capacities: [4] });
    await openBookings(page, t.booking);
    await openEditor(page, t.booking);
    await party(page, 4, 2);
    const result = await save(page, t, { partySize: 2 });
    const expected = { ...t.booking, partySize: 2, tables: [{ tableNumber: 1, seats: 2 }] };
    await persisted(page, t, { date: t.meal.date, startsAt: t.meal.startsAt, partySize: 2,
      tables: expected.tables, requirements: t.booking.requirements, slotId: t.meal.slotId });
    expect(await free(t.meal)).toBe(2);
    await changedEmail(f, t, expected, result);
  });

  test('party-wide validation prevents PATCH, while the same API reduction returns 422', async ({ page, scenario: f }) => {
    const t = await setup(f, page, { requirements: [VEGAN, VEGAN, VEGAN] });
    await openBookings(page, t.booking);
    await openEditor(page, t.booking);
    await party(page, 4, 2);
    await expect(needsSection(page)).toContainText('more than your party: remove a line or lower its guests');
    await expect(button(editor(page), 'Save changes')).toBeEnabled();
    await button(editor(page), 'Save changes').click();
    await expect(popup(page)).toHaveCount(0); // Every individual line is valid; the total is not.
    await noChange(f, t);
    const response = await t.owner.api.patch(`/api/bookings/${t.booking.id}`, { data: { partySize: 2 } });
    expect(response.status()).toBe(422);
    expect(await response.json()).toEqual({ error: 'UnprocessableError', message: 'There can be at most one requirement per person of the party' });
    await noChange(f, t);
  });
});

test.describe('MH-06 — dietary popup (Scenario 5)', () => {
  for (const variant of ['add', 'edit']) {
    test(`${variant} accepts grouped needs locally, then saves only requirements and keeps the tables`, async ({ page, scenario: f }) => {
      const t = await setup(f, page);
      await openBookings(page, t.booking);
      await openEditor(page, t.booking);
      await openNeeds(page, variant === 'edit' ? 1 : undefined);
      const guestCount = popup(page).getByRole('group', { name: 'Guests', exact: true });
      await button(guestCount, 'One more').click();
      await expect(guestCount.getByRole('status')).toHaveText('2');
      const diets = popup(page).getByRole('group', { name: 'Diet', exact: true });
      if (variant === 'add') await button(diets, 'Vegan').click();
      await expect(button(diets, 'Vegan')).toHaveAttribute('aria-pressed', 'true');
      await button(diets, 'Other').click();
      await popup(page).getByRole('textbox', { name: 'Which diet?', exact: true }).fill('Halal');
      const allergies = popup(page).getByRole('group', { name: 'Allergies', exact: true });
      await button(allergies, 'Peanuts').click();
      await expect(button(allergies, 'Peanuts')).toHaveAttribute('aria-pressed', 'true');
      await button(allergies, 'Other').click();
      await popup(page).getByRole('textbox', { name: 'Which allergy?', exact: true }).fill('Sesame');
      await popup(page).getByLabel('Anything else the kitchen should know?', { exact: true }).fill('No spicy food');
      await dismissNeeds(page, 'Done');
      await expect(needsSection(page)).toContainText('2 guests');
      await expect(needsSection(page)).toContainText('Sesame');
      await expect(editor(page).getByRole('status').filter({ hasText: 'Only the dietary needs changed.' })).toBeVisible();
      await expect(editor(page)).toContainText('Day, time and tables unchanged.');
      await noChange(f, t);
      const revised = { diets: ['VEGAN'], allergies: ['PEANUTS'], otherDiet: 'Halal', otherAllergy: 'Sesame', otherRequests: 'No spicy food' };
      const requirements = [...(variant === 'add' ? [{ diets: ['VEGAN'], allergies: [] }] : []), revised, revised];
      const result = await save(page, t, { requirements });
      const savedRequirements = requirements.map((r) => ({ ...need(r), hasAllergies: r.allergies.length > 0 || Boolean(r.otherAllergy) }));
      await persisted(page, t, { partySize: 4, date: t.meal.date, startsAt: t.meal.startsAt,
        slotId: t.meal.slotId, tables: t.booking.tables, requirements: savedRequirements });
      expect((await stored(t.booking.id)).assignments).toEqual(t.before.assignments);
      await openEditor(page, t.booking);
      await expect(needsSection(page)).toContainText('2 guests');
      await openNeeds(page, variant === 'add' ? 2 : 1);
      await expect(popup(page).getByRole('textbox', { name: 'Which allergy?', exact: true })).toHaveValue('Sesame');
      await expect(popup(page).getByRole('textbox', { name: 'Which diet?', exact: true })).toHaveValue('Halal');
      await expect(popup(page).getByLabel('Anything else the kitchen should know?', { exact: true })).toHaveValue('No spicy food');
      const email = await changedEmail(f, t, t.booking, result);
      expect(email.Text).toContain('2 guests: Allergies: Peanuts, Sesame');
      expect(email.Text).toContain('Diet: Vegan, Halal');
      expect(email.Text).toContain('"No spicy food"');
      expect(email.HTML).toContain('Sesame');
    });
  }

  for (const invalid of ['empty line', 'Other allergy without description']) {
    test(`${invalid}: Done shows validation until corrected, without persistence`, async ({ page, scenario: f }) => {
      const t = await setup(f, page);
      await openBookings(page, t.booking);
      await openEditor(page, t.booking);
      await openNeeds(page);
      if (invalid !== 'empty line') await button(popup(page).getByRole('group', { name: 'Allergies', exact: true }), 'Other').click();
      await button(popup(page), 'Done').click();
      await expect(popup(page)).toBeVisible();
      if (invalid === 'empty line') {
        await expect(popup(page)).toContainText('Choose a diet or an allergy, or write a request, or remove this line.');
        await button(popup(page).getByRole('group', { name: 'Diet', exact: true }), 'Vegetarian').click();
      } else {
        const field = popup(page).getByRole('textbox', { name: 'Which allergy?', exact: true });
        await expect(field).toHaveAttribute('aria-invalid', 'true');
        await expect(popup(page)).toContainText('Write which allergy, or unselect Other.');
        await field.fill('Sesame');
        await expect(field).not.toHaveAttribute('aria-invalid', 'true');
      }
      await noChange(f, t);
      await dismissNeeds(page, 'Done');
      await expect(button(editor(page), 'Edit line 2')).toBeVisible();
      await noChange(f, t);
      await button(editor(page), 'Close').click();
      await persisted(page, t, t.booking);
      await noChange(f, t);
    });
  }

  for (const method of ['Cancel', 'Esc']) {
    test(`${method} after invalid Done restores an existing line and removes an invalid new line`, async ({ page, scenario: f }) => {
      const t = await setup(f, page);
      await openBookings(page, t.booking);
      await openEditor(page, t.booking);
      await openNeeds(page, 1);
      await button(popup(page).getByRole('group', { name: 'Diet', exact: true }), 'Vegan').click();
      await button(popup(page), 'Done').click();
      await expect(popup(page)).toContainText('Choose a diet or an allergy, or write a request, or remove this line.');
      await dismissNeeds(page, method);
      await expect(needsSection(page)).toContainText('Vegan');
      await openNeeds(page);
      await button(popup(page).getByRole('group', { name: 'Allergies', exact: true }), 'Other').click();
      await button(popup(page), 'Done').click();
      await expect(popup(page).getByRole('textbox', { name: 'Which allergy?', exact: true })).toHaveAttribute('aria-invalid', 'true');
      await dismissNeeds(page, method);
      await expect(button(editor(page), 'Edit line 2')).toHaveCount(0);
      await expect(needsSection(page)).toContainText('1 of 4');
      await noChange(f, t);
    });
  }
});

test.describe('MH-06 — refusals and stale editors (Scenario 6)', () => {
  test('real NO_SEATS includes the current allocation and leaves booking, needs and seats unchanged', async ({ page, scenario: f }) => {
    const t = await setup(f, page);
    await openBookings(page, t.booking);
    await openEditor(page, t.booking);
    await party(page, 4, 7);
    await expect(timeRadio(page, t.meal.startsAt)).toBeEnabled();
    await expect(timeRadio(page, t.meal.startsAt)).toContainText('6 seats free');
    const result = await save(page, t, { partySize: 7 }, 409);
    expect(result.body).toEqual({ error: 'ConflictError', code: 'NO_SEATS', message: 'Not enough free seats' });
    await expect(editor(page).getByRole('alert')).toHaveText('There are not enough free seats at 12:00 – 13:00 for 7 people. Your booking stays as it is.');
    expect(await stored(t.booking.id)).toEqual(t.before);
    expect(await free(t.meal)).toBe(2);
    await persisted(page, t, t.booking);
    expect(await changeEmails(f.api, t.owner, t.booking)).toEqual([]);
  });

  test('real duplicate destination returns 422 and preserves both bookings', async ({ page, scenario: f }) => {
    const t = await setup(f, page);
    const destination = await slot(f, { date: f.dates[1], capacities: [10] });
    const otherBooking = await book(t.owner, destination);
    const beforeOther = await stored(otherBooking.id);
    await openBookings(page, t.booking);
    await openEditor(page, t.booking);
    await chooseDay(page, destination.date);
    const result = await save(page, t, { slotId: destination.slotId }, 422);
    expect(result.body).toEqual({ error: 'UnprocessableError', message: 'You already have a booking for this slot' });
    await expect(editor(page).getByRole('alert')).toHaveText('You already have a booking for this slot. Choose another day or time.');
    expect(await stored(t.booking.id)).toEqual(t.before);
    expect(await stored(otherBooking.id)).toEqual(beforeOther);
    expect(await changeEmails(f.api, t.owner, t.booking)).toEqual([]);
  });

  test('real overlapping saves return BOOKING_CHANGED, close the losing editor and refresh the winner', async ({ page, scenario: f }) => {
    const t = await setup(f, page);
    const tabB = await page.context().newPage();
    await openBookings(page, t.booking);
    await openEditor(page, t.booking);
    await party(page, 4, 6);
    const waitingUpdates = async () => (await get(`
      SELECT COUNT(DISTINCT pid)::INTEGER AS count FROM pg_locks
      WHERE database = (SELECT oid FROM pg_database WHERE datname = current_database())
        AND relation = 'booking'::REGCLASS AND mode = 'RowShareLock' AND granted
        AND cardinality(pg_blocking_pids(pid)) > 0
    `)).count;
    let winner;
    let loser;
    let refreshed;
    const started = Date.now();
    try {
      await inTransaction(async () => {
        await get('SELECT id FROM booking WHERE id = $1 FOR UPDATE', [t.booking.id]);
        winner = tabB.request.patch(`/api/bookings/${t.booking.id}`, { data: { partySize: 3 } });
        await expect.poll(waitingUpdates, { message: 'B has read the original and is waiting to update' }).toBe(1);
        loser = responseFor(page, `/api/bookings/${t.booking.id}`, 'PATCH');
        refreshed = responseFor(page, '/api/bookings');
        await button(editor(page), 'Save changes').click();
        await expect(button(editor(page), 'Saving…')).toBeDisabled();
        await expect(button(editor(page), 'Close')).toBeDisabled();
        await expect.poll(waitingUpdates, { message: 'Both real writes are blocked; B queued before A' }).toBe(2);
      }); // Commit releases the coordinator's lock; B wins before A rechecks its expected state.
    } finally {
      // The transaction rolls back and releases its lock even when an assertion fails.
      // Drain already-started HTTP operations before fixture cleanup.
      await Promise.allSettled([winner, loser].filter(Boolean));
    }
    expect((await winner).status()).toBe(200);
    const response = await loser;
    expect(response.status()).toBe(409);
    expect(await response.json()).toEqual({ error: 'ConflictError', code: 'BOOKING_CHANGED',
      message: 'The booking was changed in the meantime: reload it and try again' });
    expect((await refreshed).status()).toBe(200);
    await expect(editor(page)).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveText('This booking was changed in the meantime, so nothing was saved. Its new details are below: open it again to change it.');
    await expect(page.getByRole('status').filter({ hasText: 'We emailed you the new details.' })).toHaveCount(0);
    expect(t.observed.patches).toEqual([{ partySize: 6 }]);
    await persisted(page, t, { date: t.meal.date, startsAt: t.meal.startsAt, partySize: 3, requirements: t.booking.requirements });
    await openEditor(page, t.booking);
    await expect(editor(page).getByRole('group', { name: 'How many people', exact: true }).getByRole('status')).toHaveText('3');
    await changedEmail(f, t, { ...t.booking, partySize: 3 }, { started, finished: Date.now() });
    // Real-DAO conflict checks are also covered in server/test/dao/bookings.test.js;
    // unlike a response stub, this browser test exercises that path through HTTP.
  });

  for (const situation of ['cancelled in another tab', 'no longer found']) {
    test(`${situation}: closes the stale editor and refreshes the list without a change email`, async ({ page, scenario: f }) => {
      const t = await setup(f, page);
      await openBookings(page, t.booking);
      await openEditor(page, t.booking);
      await party(page, 4, 5);
      if (situation === 'cancelled in another tab') {
        const tabB = await page.context().newPage();
        expect((await tabB.request.delete(`/api/bookings/${t.booking.id}`)).status()).toBe(204);
      } else {
        await run('DELETE FROM booking WHERE id = $1', [t.booking.id]);
      }
      // Cancellation/deletion is setup for the MH-06 failure, not an MH-08 UI test.
      const afterExternalAction = await stored(t.booking.id);
      const status = situation === 'no longer found' ? 404 : 422;
      const result = await save(page, t, { partySize: 5 }, status, true);
      expect(result.body).toEqual(situation === 'no longer found'
        ? { error: 'NotFoundError', message: `Booking ${t.booking.id} not found` }
        : { error: 'UnprocessableError', message: 'This booking was cancelled' });
      await expect(page.getByRole('alert')).toHaveText(situation === 'no longer found'
        ? 'This booking is no longer in your list, so nothing was saved.'
        : 'This booking was cancelled, so nothing was saved.');
      await expect(card(page, t.booking)).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'No upcoming bookings.' })).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: 'We emailed you the new details.' })).toHaveCount(0);
      expect(await stored(t.booking.id)).toEqual(afterExternalAction);
      expect(await changeEmails(f.api, t.owner, t.booking)).toEqual([]);
    });
  }
});

test.describe('MH-06 — deadlines and ownership (Scenarios 7, 8, 10)', () => {
  async function nearMeal(f) {
    const date = romeDay(1); // Tomorrow: comfortably inside 48 hours, not an exact-boundary test.
    for (let hour = 7; hour < 21; hour += 1) {
      const startsAt = `${String(hour).padStart(2, '0')}:00`;
      if (!(await get('SELECT 1 FROM slot WHERE service_date = $1 AND starts_at = $2', [date, startsAt]))) {
        return slot(f, { date, startsAt, endsAt: `${String(hour + 1).padStart(2, '0')}:00` });
      }
    }
    throw new Error('No free fixture time tomorrow; other stories’ data was left untouched');
  }

  test('near-deadline Edit is disabled and a separate real API change returns 422', async ({ page, scenario: f }) => {
    const owner = await hiker(f, page.request);
    const meal = await nearMeal(f);
    const booking = await book(owner, meal);
    const destination = await slot(f);
    const before = await stored(booking.id);
    const observed = observe(page, booking.id);
    await openBookings(page, booking);
    await expect(button(card(page, booking), 'Edit')).toBeDisabled();
    await expect(card(page, booking)).toContainText('Changes closed on');
    await expect(editor(page)).toHaveCount(0);
    expect(observed.patches).toEqual([]);
    const response = await owner.api.patch(`/api/bookings/${booking.id}`, { data: { slotId: destination.slotId } });
    expect(response.status()).toBe(422);
    expect(await response.json()).toEqual({ error: 'UnprocessableError', message: 'Bookings can be changed until 48 hours before the meal' });
    expect(await stored(booking.id)).toEqual(before);
    await persisted(page, { owner, booking }, booking);
    expect(await changeEmails(f.api, owner, booking)).toEqual([]);
  });

  test('API-only: a destination inside 48 hours is rejected without forcing a UI selection', async ({ page, scenario: f }) => {
    const t = await setup(f, page);
    const destination = await nearMeal(f);
    await openBookings(page, t.booking);
    await expect(button(card(page, t.booking), 'Edit')).toBeEnabled();
    const response = await t.owner.api.patch(`/api/bookings/${t.booking.id}`, { data: { slotId: destination.slotId } });
    expect(response.status()).toBe(422);
    expect(await response.json()).toEqual({ error: 'UnprocessableError', message: 'Bookings can be changed until 48 hours before the meal' });
    await persisted(page, t, t.booking);
    await noChange(f, t);
  });

  test('a hiker sees only their own booking and a real PATCH of another owner returns 404', async ({ page, scenario: f }) => {
    const t = await setup(f, page, { capacities: [10] });
    const other = await hiker(f, f.api);
    const otherBooking = await book(other, t.meal);
    const otherBefore = await stored(otherBooking.id);
    await openBookings(page, t.booking);
    await expect(card(page, otherBooking)).toHaveCount(0);
    const response = await t.owner.api.patch(`/api/bookings/${otherBooking.id}`, { data: { partySize: 3 } });
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: 'NotFoundError', message: `Booking ${otherBooking.id} not found` });
    expect((await list(t.owner)).map(({ id }) => id)).toEqual([t.booking.id]);
    expect((await list(other)).map(({ id }) => id)).toEqual([otherBooking.id]);
    expect(await stored(otherBooking.id)).toEqual(otherBefore);
    await persisted(page, t, t.booking);
    await noChange(f, t);
    expect(await changeEmails(f.api, other, otherBooking)).toEqual([]);
  });
});
