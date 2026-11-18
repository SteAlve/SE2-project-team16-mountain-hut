// MH-5 Provide party requirements: the scenarios of
// docs/e2e-definitions/MH-5-provide-party-requirements-e2e-scenarios.md.
// The scenarios that read the confirmation email (1, 11, 12 and 13) use Mailpit, like MH-3: the server
// sends its emails to it (SMTP_HOST and SMTP_PORT) and the tests read them through its API at MAILPIT_URL.
// Without MAILPIT_URL the email checks are skipped and the rest of the scenarios still run.
import { expect, test } from '@playwright/test';

if (process.env.E2E_DATABASE_URL) process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
const { close, get, inTransaction, run } = await import('../../server/src/dao/db.js');

const mailpit = process.env.MAILPIT_URL;
const password = 'quota-e2e-2026';
// How long the tests wait for an email, and how long they make sure none arrives.
const EMAIL_TIMEOUT_MS = 10_000;
const NO_EMAIL_WINDOW_MS = 3_000;

let fixture;

// ---------------------------------------------------------------------------------------------
// Fixture: a slot tomorrow with tables of the given seats, and the hikers the test creates.
// ---------------------------------------------------------------------------------------------

// Tomorrow in the time zone of the hut: always more than two hours away, and in the day strip. It adds one
// calendar day to today's date at the hut, not 24 hours, so the change of the daylight-saving time does not matter.
const tomorrowInRome = () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
  const [year, month, dayOfMonth] = today.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, dayOfMonth + 1)).toISOString().slice(0, 10);
};

// A start time between 10:00 and 11:59, so two runs do not meet on the same slot; the meal ends
// two hours later, on the same day.
const randomLunchTime = () => {
  const minutes = 10 * 60 + Math.floor(Math.random() * 120);
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
  return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`;
};

const unique = () => `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function createTableSet(seats) {
  const set = await run('INSERT INTO table_set (name) VALUES ($1) RETURNING id', [`E2E MH-5 ${unique()}`]);
  const tableSetId = set.rows[0].id;
  for (const [index, capacity] of seats.entries()) {
    await run(
      'INSERT INTO hut_table (table_set_id, table_number, seat_capacity) VALUES ($1, $2, $3)',
      [tableSetId, index + 1, capacity],
    );
  }
  return tableSetId;
}

async function createSlot(date, startsAt, tableSetId) {
  const slot = await run(
    `INSERT INTO slot (service_date, starts_at, ends_at, table_set_id)
     VALUES ($1, $2, ($2::time + interval '2 hours')::time, $3) RETURNING id`,
    [date, startsAt, tableSetId],
  );
  return slot.rows[0].id;
}

// The slot of the test, tomorrow, with tables of the given seats.
async function createFixture(seats) {
  const date = tomorrowInRome();
  const startsAt = randomLunchTime();
  return inTransaction(async () => {
    const tableSetId = await createTableSet(seats);
    const slotId = await createSlot(date, startsAt, tableSetId);
    return { tableSetIds: [tableSetId], slotIds: [slotId], slotId, date, startsAt, emails: [] };
  });
}

// Another slot the same day with its own tables, some hours after the first.
async function addSlot(seats, hoursLater = 3) {
  const later = `${String(Number(fixture.startsAt.slice(0, 2)) + hoursLater).padStart(2, '0')}${fixture.startsAt.slice(2)}`;
  return inTransaction(async () => {
    const tableSetId = await createTableSet(seats);
    const slotId = await createSlot(fixture.date, later, tableSetId);
    fixture.tableSetIds.push(tableSetId);
    fixture.slotIds.push(slotId);
    return { slotId, startsAt: later };
  });
}

async function cleanupFixture() {
  if (!fixture) return;
  await inTransaction(async () => {
    // The needs of a booking go with it (ON DELETE CASCADE).
    await run('DELETE FROM booking WHERE slot_id = ANY($1::int[])', [fixture.slotIds]);
    await run('DELETE FROM slot WHERE id = ANY($1::int[])', [fixture.slotIds]);
    await run('DELETE FROM hut_table WHERE table_set_id = ANY($1::int[])', [fixture.tableSetIds]);
    await run('DELETE FROM table_set WHERE id = ANY($1::int[])', [fixture.tableSetIds]);
    if (fixture.emails.length > 0) await run('DELETE FROM app_user WHERE email = ANY($1::text[])', [fixture.emails]);
  });
  fixture = undefined;
}

// A new hiker with an address no other test uses, so an old email cannot answer for this one.
async function createHiker(request) {
  const suffix = unique();
  const hiker = { firstName: 'Mara', lastName: `Rossi ${suffix.slice(-6)}`, email: `e2e-mh5-${suffix}@example.com`, phone: '', password };
  const response = await request.post('/api/auth/register', { data: hiker });
  expect(response.ok(), await response.text()).toBeTruthy();
  fixture.emails.push(hiker.email);
  return hiker;
}

// ---------------------------------------------------------------------------------------------
// The browser: log in, choose the time, open "Check your booking", fill in the needs.
// ---------------------------------------------------------------------------------------------

async function login(page, hiker) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(hiker.email);
  await page.getByRole('textbox', { name: 'Password' }).fill(hiker.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/book/);
}

async function chooseDay(page, date) {
  const dayNumber = String(Number(date.slice(-2)));
  await page.locator('button[role="radio"]').filter({ hasText: new RegExp(`(?:^|\\D)${dayNumber}(?:\\D|$)`) }).first().click();
}

const timeRadio = (page, startsAt) => page.getByRole('radio', { name: new RegExp(startsAt.slice(0, 5)) });

const reviewDialog = (page) => page.getByRole('dialog', { name: 'Check your booking' });
const needsPopup = (page) => page.getByRole('dialog', { name: /(Add|Edit) a guest.s needs/ });
const addButton = (page) => reviewDialog(page).getByRole('button', { name: /Add a guest.s needs/ });
const rows = (page) => reviewDialog(page).getByRole('listitem');
// "1 of 4 guests · every guest is counted"
const counter = (page) => reviewDialog(page).locator('p[aria-live="polite"]');

// Logs in, chooses the day, the people and the time of the fixture and opens "Check your booking".
async function openReview(page, hiker, { people, startsAt = fixture.startsAt }) {
  await login(page, hiker);
  await page.goto('/book');
  await chooseDay(page, fixture.date);
  for (let i = 1; i < people; i += 1) await page.getByRole('button', { name: 'One more' }).click();
  const time = timeRadio(page, startsAt);
  await time.click();
  await expect(time).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Review booking' }).click();
  await expect(reviewDialog(page)).toBeVisible();
}

// Opens the popup of a new line and fills it in. `line` can have: guests, diets, allergies (the names of
// the cards, 'Other' included), otherDiet, otherAllergy and otherRequests. It does not press Done.
async function fillLine(page, line) {
  await addButton(page).click();
  const popup = needsPopup(page);
  await expect(popup).toBeVisible();
  await expect(popup).toContainText('Add a guest’s needs');
  for (let i = 1; i < (line.guests ?? 1); i += 1) await popup.getByRole('button', { name: 'One more' }).click();
  for (const name of line.diets ?? []) await popup.getByRole('group', { name: 'Diet' }).getByRole('button', { name, exact: true }).click();
  for (const name of line.allergies ?? []) await popup.getByRole('group', { name: 'Allergies' }).getByRole('button', { name, exact: true }).click();
  if (line.otherDiet !== undefined) await popup.getByLabel('Which diet?').fill(line.otherDiet);
  if (line.otherAllergy !== undefined) await popup.getByLabel('Which allergy?').fill(line.otherAllergy);
  if (line.otherRequests !== undefined) await popup.getByLabel('Anything else the kitchen should know?').fill(line.otherRequests);
  return popup;
}

// fillLine and Done: the line folds into a row of the dialog.
async function addLine(page, line) {
  const popup = await fillLine(page, line);
  await popup.getByRole('button', { name: 'Done' }).click();
  await expect(needsPopup(page)).toHaveCount(0);
}

// Confirm booking; gives the status and the body the server answered.
async function confirm(page) {
  const answer = page.waitForResponse((r) => r.url().endsWith('/api/bookings') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirm booking' }).click();
  const response = await answer;
  return { status: response.status(), sent: response.request().postDataJSON(), booking: await response.json().catch(() => null) };
}

// The needs that were saved for the booking of a slot, from the database (the server is the truth).
const savedNeedsCount = async (slotId) => (await get(
  `SELECT COUNT(*)::INTEGER AS count FROM booking_requirement
   WHERE booking_id IN (SELECT id FROM booking WHERE slot_id = $1)`,
  [slotId],
)).count;

const bookingCount = async (slotId) => (await get(
  'SELECT COUNT(*)::INTEGER AS count FROM booking WHERE slot_id = $1 AND cancelled_at IS NULL',
  [slotId],
)).count;

const bookedNeeds = (page) => page.getByRole('region', { name: /Dietary needs/ });

// ---------------------------------------------------------------------------------------------
// The API: for the scenarios that check what the server accepts and answers.
// ---------------------------------------------------------------------------------------------

async function apiLogin(request, hiker) {
  const response = await request.post('/api/auth/login', { data: { email: hiker.email, password: hiker.password } });
  expect(response.ok(), await response.text()).toBeTruthy();
}

// Books the party of the slot at the tables the seating preview proposes, with the given requirements.
async function apiBook(request, slotId, partySize, requirements) {
  const preview = await request.get(`/api/slots/${slotId}/seating`, { params: { partySize } });
  expect(preview.ok(), await preview.text()).toBeTruthy();
  const { tables } = await preview.json();
  const response = await request.post('/api/bookings', { data: { slotId, partySize, tables, requirements } });
  return { status: response.status(), body: await response.json() };
}

// ---------------------------------------------------------------------------------------------
// Mailpit: the emails of an address.
// ---------------------------------------------------------------------------------------------

async function emailsTo(request, address) {
  const response = await request.get(`${mailpit}/api/v1/search`, { params: { query: `to:"${address}"` } });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).messages;
}

async function readEmail(request, id) {
  const response = await request.get(`${mailpit}/api/v1/message/${id}`);
  expect(response.ok()).toBeTruthy();
  return response.json();
}

// Waits until an address has `count` emails and reads the last one whole: text and HTML.
async function waitForEmail(request, address, count = 1) {
  let messages = [];
  await expect.poll(async () => {
    messages = await emailsTo(request, address);
    return messages.length;
  }, { timeout: EMAIL_TIMEOUT_MS }).toBeGreaterThanOrEqual(count);
  // Mailpit lists the newest first.
  return { count: messages.length, ...(await readEmail(request, messages[0].ID)) };
}

// Makes sure no email reaches the address (the window is the time the server would need to send one).
async function expectNoEmail(request, address) {
  await new Promise((resolve) => { setTimeout(resolve, NO_EMAIL_WINDOW_MS); });
  expect(await emailsTo(request, address)).toEqual([]);
}

// '2026-11-19' -> '19 November 2026', as the email writes the day.
const emailDay = (date) => {
  const [year, month, dayOfMonth] = date.split('-').map(Number);
  const name = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
  return `${dayOfMonth} ${name} ${year}`;
};

const visibleText = (html) => html
  .replace(/<[^>]+>/g, ' ')
  .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&')
  .replace(/\s+/g, ' ');

// ---------------------------------------------------------------------------------------------

test.describe('MH-5 Provide party requirements', () => {
  test.afterEach(async () => {
    await cleanupFixture();
  });

  test.afterAll(async () => {
    await close();
  });

  test('Scenario 1: a booking with no dietary needs', async ({ page, request }) => {
    fixture = await createFixture([4]);
    const hiker = await createHiker(request);

    await openReview(page, hiker, { people: 4 });
    const review = reviewDialog(page);
    await expect(review).toContainText('Dietary needs and allergies');
    await expect(review).toContainText('Optional');
    await expect(review).toContainText('No dietary needs or allergies for this booking.');

    const { status, booking } = await confirm(page);

    expect(status).toBe(201);
    expect(booking.requirements).toEqual([]);
    await expect(page.getByRole('heading', { name: 'Table booked' })).toBeVisible();
    await expect(bookedNeeds(page)).toHaveCount(0);
    await page.goto('/bookings');
    await expect(page.getByText('No dietary needs')).toBeVisible();
    expect(await savedNeedsCount(fixture.slotId)).toBe(0);

    if (mailpit) {
      const email = await waitForEmail(request, hiker.email);
      expect(email.Text).not.toContain('Dietary needs');
      expect(email.HTML).not.toContain('Dietary needs');
    }
  });

  test('Scenario 2: the needs of one guest, a diet and an allergy', async ({ page, request }) => {
    fixture = await createFixture([4]);
    const hiker = await createHiker(request);

    await openReview(page, hiker, { people: 4 });
    await addButton(page).click();
    const popup = needsPopup(page);
    await expect(popup).toContainText('Add a guest’s needs');
    await expect(popup.getByRole('group', { name: 'Guests' })).toContainText('1');
    const vegan = popup.getByRole('group', { name: 'Diet' }).getByRole('button', { name: 'Vegan', exact: true });
    const peanuts = popup.getByRole('group', { name: 'Allergies' }).getByRole('button', { name: 'Peanuts', exact: true });
    await vegan.click();
    await peanuts.click();
    await expect(vegan).toHaveAttribute('aria-pressed', 'true');
    await expect(peanuts).toHaveAttribute('aria-pressed', 'true');
    await popup.getByRole('button', { name: 'Done' }).click();

    await expect(needsPopup(page)).toHaveCount(0);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('1 guest');
    await expect(rows(page).first()).toContainText('Peanuts');
    await expect(rows(page).first()).toContainText('Vegan');
    await expect(counter(page)).toContainText('1 of 4');

    const { status, booking } = await confirm(page);

    expect(status).toBe(201);
    expect(booking.requirements).toEqual([
      { diets: ['VEGAN'], otherDiet: null, allergies: ['PEANUTS'], otherAllergy: null, otherRequests: null, hasAllergies: true },
    ]);
    await expect(page.getByRole('heading', { name: 'Dietary needs · 1 of 4 guests' })).toBeVisible();
    const cards = bookedNeeds(page).getByRole('listitem');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('×1');
    await expect(cards.first()).toContainText('Peanuts');
    await expect(cards.first()).toContainText('Vegan');

    await page.goto('/bookings');
    await expect(page.getByText('Peanuts')).toBeVisible();
    await expect(page.getByText('Vegan')).toBeVisible();
  });

  test('Scenario 3: several requirements for subsets of the party', async ({ page, request }) => {
    fixture = await createFixture([4]);
    const hiker = await createHiker(request);

    await openReview(page, hiker, { people: 4 });
    await addLine(page, { diets: ['Vegan'], allergies: ['Peanuts'] });
    await addLine(page, { allergies: ['Shellfish'] });
    await addLine(page, { guests: 2, diets: ['Vegetarian'] });

    await expect(counter(page)).toContainText('4 of 4');
    await expect(counter(page)).toContainText('every guest is counted');
    await expect(addButton(page)).toBeDisabled();
    await expect(rows(page)).toHaveCount(3);
    await expect(rows(page).nth(0)).toContainText('1 guest');
    await expect(rows(page).nth(0)).toContainText('Peanuts');
    await expect(rows(page).nth(1)).toContainText('Shellfish');
    await expect(rows(page).nth(2)).toContainText('2 guests');
    await expect(rows(page).nth(2)).toContainText('Vegetarian');

    const { status, sent, booking } = await confirm(page);

    expect(status).toBe(201);
    const withoutFlag = ({ hasAllergies, ...need }) => need;
    expect(booking.requirements.map(withoutFlag)).toEqual([
      { diets: ['VEGAN'], otherDiet: null, allergies: ['PEANUTS'], otherAllergy: null, otherRequests: null },
      { diets: [], otherDiet: null, allergies: ['SHELLFISH'], otherAllergy: null, otherRequests: null },
      { diets: ['VEGETARIAN'], otherDiet: null, allergies: [], otherAllergy: null, otherRequests: null },
      { diets: ['VEGETARIAN'], otherDiet: null, allergies: [], otherAllergy: null, otherRequests: null },
    ]);
    expect(booking.requirements.map((r) => r.hasAllergies)).toEqual([true, true, false, false]);
    // The needs did not change where the party sits: the tables are the ones that were sent.
    expect(booking.tables).toEqual(sent.tables);

    await expect(page.getByRole('heading', { name: 'Dietary needs · 4 of 4 guests' })).toBeVisible();
    const cards = bookedNeeds(page).getByRole('listitem');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toContainText('×1');
    await expect(cards.nth(1)).toContainText('×1');
    await expect(cards.nth(2)).toContainText('×2');
  });

  test.describe('Scenario 4: the allergies flag is derived from the allergies', () => {
    const dataSets = [
      ['a preset allergy', { allergies: ['EGGS'] }, true],
      ['an allergy in words', { otherAllergy: 'sesame' }, true],
      ['a diet only', { diets: ['VEGAN'] }, false],
      ['other diet and requests only', { otherDiet: 'halal', otherRequests: 'No spicy food' }, false],
      ['a diet and an allergy', { diets: ['PESCATARIAN'], allergies: ['MILK'] }, true],
    ];

    for (const [name, requirement, hasAllergies] of dataSets) {
      test(name, async ({ request }) => {
        fixture = await createFixture([4]);
        const hiker = await createHiker(request);
        await apiLogin(request, hiker);

        const { status, body } = await apiBook(request, fixture.slotId, 1, [requirement]);

        expect(status).toBe(201);
        expect(body.requirements).toEqual([{
          diets: [], otherDiet: null, allergies: [], otherAllergy: null, otherRequests: null, ...requirement, hasAllergies,
        }]);
        const list = await (await request.get('/api/bookings')).json();
        expect(list.find((b) => b.id === body.id).requirements).toEqual(body.requirements);
      });
    }

    test('a client cannot send the flag', async ({ request }) => {
      fixture = await createFixture([4]);
      const hiker = await createHiker(request);
      await apiLogin(request, hiker);

      const { status, body } = await apiBook(request, fixture.slotId, 1, [{ allergies: ['EGGS'], hasAllergies: false }]);

      expect(status).toBe(400);
      expect(body).toEqual({ error: 'ValidationError', message: 'Unknown field in requirements: hasAllergies' });
      expect(await bookingCount(fixture.slotId)).toBe(0);
    });
  });

  test('Scenario 5: a diet or an allergy that is not in the list', async ({ page, request }) => {
    fixture = await createFixture([2]);
    const hiker = await createHiker(request);

    await openReview(page, hiker, { people: 2 });
    const popup = await fillLine(page, { diets: ['Other'] });
    await expect(popup.getByLabel('Which diet?')).toBeVisible();
    await popup.getByRole('button', { name: 'Done' }).click();
    await expect(popup).toContainText('Write which diet, or unselect Other.');
    await expect(needsPopup(page)).toHaveCount(1);

    await popup.getByLabel('Which diet?').fill('halal');
    await popup.getByRole('group', { name: 'Allergies' }).getByRole('button', { name: 'Other', exact: true }).click();
    await popup.getByLabel('Which allergy?').fill('sesame');
    await popup.getByRole('button', { name: 'Done' }).click();
    await expect(needsPopup(page)).toHaveCount(0);
    await expect(rows(page).first()).toContainText('sesame');
    await expect(rows(page).first()).toContainText('halal');

    const { status, booking } = await confirm(page);

    expect(status).toBe(201);
    expect(booking.requirements).toEqual([
      { diets: [], otherDiet: 'halal', allergies: [], otherAllergy: 'sesame', otherRequests: null, hasAllergies: true },
    ]);
    await expect(bookedNeeds(page)).toContainText('sesame');
    await expect(bookedNeeds(page)).toContainText('halal');
  });

  test.describe('Scenario 6, part A: browser validation', () => {
    const dataSets = [
      ['nothing chosen', {}, 'Choose a diet or an allergy, or write a request, or remove this line.', {}],
      ['an Other diet that is empty', { diets: ['Other'] }, 'Write which diet, or unselect Other.', { otherDiet: 'vegan-ish' }],
      ['an Other allergy that is empty', { allergies: ['Other'] }, 'Write which allergy, or unselect Other.', { otherAllergy: 'celery' }],
      ['an Other diet that is too long', { diets: ['Other'], otherDiet: 'd'.repeat(101) }, 'Too long: at most 100 characters.', { otherDiet: 'd'.repeat(100) }],
      ['an Other allergy that is too long', { allergies: ['Other'], otherAllergy: 'a'.repeat(101) }, 'Too long: at most 100 characters.', { otherAllergy: 'a'.repeat(100) }],
      ['a request that is too long', { otherRequests: 'r'.repeat(301) }, 'Too long: at most 300 characters.', { otherRequests: 'r'.repeat(300) }],
    ];

    for (const [name, line, message, correction] of dataSets) {
      test(name, async ({ page, request }) => {
        fixture = await createFixture([2]);
        const hiker = await createHiker(request);
        let bookingRequests = 0;
        page.on('request', (r) => {
          if (r.method() === 'POST' && r.url().endsWith('/api/bookings')) bookingRequests += 1;
        });

        await openReview(page, hiker, { people: 2 });
        const popup = await fillLine(page, line);
        await popup.getByRole('button', { name: 'Done' }).click();

        // The line cannot be closed: the popup stays open with the problem marked.
        await expect(popup).toContainText(message);
        await expect(needsPopup(page)).toHaveCount(1);
        expect(bookingRequests).toBe(0);

        // The correction: choose something, or write a valid text.
        if (Object.keys(correction).length === 0) {
          await popup.getByRole('group', { name: 'Diet' }).getByRole('button', { name: 'Vegan', exact: true }).click();
        }
        if (correction.otherDiet) await popup.getByLabel('Which diet?').fill(correction.otherDiet);
        if (correction.otherAllergy) await popup.getByLabel('Which allergy?').fill(correction.otherAllergy);
        if (correction.otherRequests) await popup.getByLabel('Anything else the kitchen should know?').fill(correction.otherRequests);
        await popup.getByRole('button', { name: 'Done' }).click();

        await expect(needsPopup(page)).toHaveCount(0);
        await expect(rows(page)).toHaveCount(1);
        expect(bookingRequests).toBe(0);
      });
    }
  });

  test.describe('Scenario 6, part B: API validation', () => {
    const wrong = [
      ['an empty requirement', [{}], 'Each requirement needs a diet, an allergy or a request'],
      ['a blank text', [{ otherRequests: '   ' }], 'otherRequests cannot be empty'],
      ['a request of 301 characters', [{ otherRequests: 'r'.repeat(301) }], 'otherRequests can be at most 300 characters'],
      ['an other diet of 101 characters', [{ otherDiet: 'd'.repeat(101) }], 'otherDiet can be at most 100 characters'],
    ];

    for (const [name, requirements, message] of wrong) {
      test(`refuses ${name}`, async ({ request }) => {
        fixture = await createFixture([2]);
        const hiker = await createHiker(request);
        await apiLogin(request, hiker);

        const { status, body } = await apiBook(request, fixture.slotId, 2, requirements);

        expect(status).toBe(400);
        expect(body).toEqual({ error: 'ValidationError', message });
        expect(await bookingCount(fixture.slotId)).toBe(0);
        expect(await savedNeedsCount(fixture.slotId)).toBe(0);
        const seating = await request.get(`/api/slots/${fixture.slotId}/seating`, { params: { partySize: 2 } });
        expect(seating.status()).toBe(200);
        if (mailpit) await expectNoEmail(request, hiker.email);
      });
    }

    test('accepts the longest texts allowed', async ({ request }) => {
      fixture = await createFixture([2]);
      const hiker = await createHiker(request);
      await apiLogin(request, hiker);

      const { status, body } = await apiBook(request, fixture.slotId, 1, [
        { otherDiet: 'd'.repeat(100), otherAllergy: 'a'.repeat(100), otherRequests: 'r'.repeat(300) },
      ]);

      expect(status).toBe(201);
      expect(body.requirements[0].otherDiet).toHaveLength(100);
      expect(body.requirements[0].otherAllergy).toHaveLength(100);
      expect(body.requirements[0].otherRequests).toHaveLength(300);
    });
  });

  test('Scenario 7: a request for the kitchen with no diet or allergy', async ({ page, request }) => {
    fixture = await createFixture([4]);
    const hiker = await createHiker(request);

    await openReview(page, hiker, { people: 3 });
    await addLine(page, { otherRequests: 'High chair' });
    await expect(rows(page).first()).toContainText('1 guest');

    const { status, booking } = await confirm(page);

    expect(status).toBe(201);
    expect(booking.requirements).toEqual([
      { diets: [], otherDiet: null, allergies: [], otherAllergy: null, otherRequests: 'High chair', hasAllergies: false },
    ]);
    await expect(bookedNeeds(page)).toContainText('“High chair”');
    await page.goto('/bookings');
    await expect(page.getByText('Other requests: High chair')).toBeVisible();
    await expect(page.getByText('No dietary needs')).toHaveCount(0);
  });

  test('Scenario 8: diets that exclude each other, and diets that go together', async ({ page, request }) => {
    fixture = await createFixture([4]);
    const hiker = await createHiker(request);

    await openReview(page, hiker, { people: 2 });
    await addButton(page).click();
    const popup = needsPopup(page);
    const diet = (name) => popup.getByRole('group', { name: 'Diet' }).getByRole('button', { name, exact: true });
    await diet('Vegetarian').click();
    await diet('Vegan').click();
    await expect(diet('Vegan')).toHaveAttribute('aria-pressed', 'true');
    await expect(diet('Vegetarian')).toHaveAttribute('aria-pressed', 'false');
    await diet('Lactose-free').click();
    await expect(diet('Lactose-free')).toHaveAttribute('aria-pressed', 'true');
    await expect(diet('Vegan')).toHaveAttribute('aria-pressed', 'true');

    // The server refuses two exclusive diets and accepts a diet with lactose-free.
    await apiLogin(request, hiker);
    const refused = await apiBook(request, fixture.slotId, 1, [{ diets: ['VEGAN', 'VEGETARIAN'] }]);
    expect(refused.status).toBe(400);
    expect(refused.body).toEqual({ error: 'ValidationError', message: 'A guest can follow only one of VEGETARIAN, VEGAN, PESCATARIAN' });
    expect(await bookingCount(fixture.slotId)).toBe(0);
    const accepted = await apiBook(request, fixture.slotId, 1, [{ diets: ['VEGAN', 'LACTOSE_FREE'] }]);
    expect(accepted.status).toBe(201);
  });

  test('Scenario 9: the needs cannot count more guests than the party', async ({ page, request }) => {
    fixture = await createFixture([4]);
    const hiker = await createHiker(request);

    await openReview(page, hiker, { people: 3 });
    await addLine(page, { guests: 2, diets: ['Vegan'] });
    await addButton(page).click();
    const popup = needsPopup(page);
    await expect(popup.getByRole('button', { name: 'One more' })).toBeDisabled();
    await popup.getByRole('group', { name: 'Diet' }).getByRole('button', { name: 'Vegetarian', exact: true }).click();
    await popup.getByRole('button', { name: 'Done' }).click();

    await expect(counter(page)).toContainText('3 of 3');
    await expect(counter(page)).toContainText('every guest is counted');
    await expect(addButton(page)).toBeDisabled();

    // At API level: more requirements than people is refused, as many as people is accepted.
    await apiLogin(request, hiker);
    const four = Array.from({ length: 4 }, () => ({ diets: ['VEGAN'] }));
    const refused = await apiBook(request, fixture.slotId, 3, four);
    expect(refused.status).toBe(400);
    expect(refused.body).toEqual({ error: 'ValidationError', message: 'There can be at most one requirement per person of the party' });
    expect(await bookingCount(fixture.slotId)).toBe(0);
    const accepted = await apiBook(request, fixture.slotId, 3, four.slice(0, 3));
    expect(accepted.status).toBe(201);
  });

  test('Scenario 10: Cancel, Esc, Back and Remove keep the right choices', async ({ page, request }) => {
    fixture = await createFixture([4]);
    const hiker = await createHiker(request);
    let bookingRequests = 0;
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/api/bookings')) bookingRequests += 1;
    });

    await openReview(page, hiker, { people: 4 });
    await addLine(page, { guests: 2, diets: ['Vegetarian'] });

    // Cancel leaves the line as it was.
    await reviewDialog(page).getByRole('button', { name: 'Edit line 1' }).click();
    let popup = needsPopup(page);
    await expect(popup).toContainText('Edit a guest’s needs');
    await popup.getByRole('group', { name: 'Diet' }).getByRole('button', { name: 'Vegan', exact: true }).click();
    await popup.getByRole('button', { name: 'Cancel' }).click();
    await expect(needsPopup(page)).toHaveCount(0);
    await expect(rows(page).first()).toContainText('2 guests');
    await expect(rows(page).first()).toContainText('Vegetarian');
    await expect(rows(page).first()).not.toContainText('Vegan');

    // Esc drops a line that was just added.
    await fillLine(page, { allergies: ['Fish'] });
    await page.keyboard.press('Escape');
    await expect(needsPopup(page)).toHaveCount(0);
    await expect(rows(page)).toHaveCount(1);
    await expect(counter(page)).toContainText('2 of 4');

    // Back and Review booking again: the line is still there, folded.
    await reviewDialog(page).getByRole('button', { name: 'Back' }).click();
    await expect(reviewDialog(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Review booking' }).click();
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Vegetarian');

    // Remove the line.
    await reviewDialog(page).getByRole('button', { name: 'Remove line 1' }).click();
    await expect(reviewDialog(page)).toContainText('No dietary needs or allergies for this booking.');
    expect(bookingRequests).toBe(0);
  });

  test.describe('with the emails of Mailpit', () => {
    test.skip(!mailpit, 'Set MAILPIT_URL, SMTP_HOST and SMTP_PORT to run these tests against Mailpit.');

    test('Scenario 11: the confirmation email carries the needs to the hiker', async ({ page, request }) => {
      fixture = await createFixture([4]);
      const hiker = await createHiker(request);
      expect(await emailsTo(request, hiker.email)).toEqual([]);
      const typed = 'No mushrooms <b>no nuts</b> & "spicy"';

      await openReview(page, hiker, { people: 4 });
      await addLine(page, { diets: ['Vegan'], allergies: ['Peanuts'] });
      await addLine(page, { allergies: ['Shellfish'], otherRequests: typed });
      await addLine(page, { guests: 2, diets: ['Vegetarian'] });

      const { status, booking } = await confirm(page);
      expect(status).toBe(201);
      expect(booking.requirements[1].otherRequests).toBe(typed);

      const email = await waitForEmail(request, hiker.email);
      expect(email.To.map(({ Address }) => Address)).toEqual([hiker.email]);
      const reference = `QUOTA-${String(booking.id).padStart(5, '0')}`;
      expect(email.Subject).toContain(reference);

      // The details of the email are the ones of the saved booking and of the slot (MH-3).
      const saved = (await (await request.get('/api/bookings')).json()).find((b) => b.id === booking.id);
      const details = {
        'Booking reference': reference,
        Name: `${hiker.firstName} ${hiker.lastName}`,
        Date: emailDay(saved.date),
        Time: `${saved.startsAt}–${saved.endsAt}`,
        'Party size': String(saved.partySize),
      };
      expect(saved.date).toBe(fixture.date);
      expect(saved.startsAt).toBe(fixture.startsAt.slice(0, 5));
      expect(saved.partySize).toBe(4);
      for (const [label, value] of Object.entries(details)) {
        expect(email.Text.split('\n').map((l) => l.trimEnd())).toContain(`${label}: ${value}`);
      }
      const htmlText = visibleText(email.HTML);
      for (const [label, value] of Object.entries(details)) {
        expect(htmlText).toMatch(new RegExp(`${label}\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
      }

      // The plain text: a section with a line per group, in the order of the lines, and the request as typed.
      expect(email.Text).toContain('Dietary needs:');
      const lines = email.Text.split('\n').map((l) => l.trimEnd());
      const needs = lines.slice(lines.indexOf('Dietary needs:') + 1).filter((l) => l.startsWith('- '));
      expect(needs).toEqual([
        '- 1 guest: Allergies: Peanuts · Diet: Vegan',
        `- 1 guest: Allergies: Shellfish · "${typed}"`,
        '- 2 guests: Diet: Vegetarian',
      ]);
      // The table numbers are not in the email.
      expect(email.Text).not.toMatch(/table \d/i);

      // The HTML: the same section, and what the hiker typed is escaped, not read as markup.
      expect(email.HTML).toContain('Dietary needs');
      expect(email.HTML).toContain('&lt;b&gt;no nuts&lt;/b&gt;');
      expect(email.HTML).toContain('&amp;');
      expect(email.HTML).not.toContain('<b>no nuts</b>');
      const html = visibleText(email.HTML);
      expect(html).toContain(typed);
      for (const part of ['1 guest', 'Peanuts', 'Vegan', 'Shellfish', '2 guests', 'Vegetarian']) expect(html).toContain(part);
      expect(html.indexOf('Peanuts')).toBeLessThan(html.indexOf('Vegan'));

      // The API, Table booked and My bookings show it as text.
      await expect(bookedNeeds(page)).toContainText(typed);
      await page.goto('/bookings');
      await expect(page.getByText(`Other requests: ${typed}`)).toBeVisible();
    });

    test('Scenario 12: each booking sends only its own needs', async ({ browser, request }) => {
      fixture = await createFixture([4]);
      const second = await addSlot([4]);
      const third = await addSlot([4], 6);
      const hikerA = await createHiker(request);
      const hikerB = await createHiker(request);
      expect(await emailsTo(request, hikerA.email)).toEqual([]);
      expect(await emailsTo(request, hikerB.email)).toEqual([]);

      const contextA = await browser.newContext({ baseURL: test.info().project.use.baseURL });
      const contextB = await browser.newContext({ baseURL: test.info().project.use.baseURL });
      try {
        const pageA = await contextA.newPage();
        const pageB = await contextB.newPage();

        await openReview(pageA, hikerA, { people: 1 });
        await addLine(pageA, { diets: ['Vegan'] });
        expect((await confirm(pageA)).status).toBe(201);

        await openReview(pageB, hikerB, { people: 1, startsAt: second.startsAt });
        await addLine(pageB, { allergies: ['Gluten'] });
        expect((await confirm(pageB)).status).toBe(201);

        await pageA.goto('/book');
        await chooseDay(pageA, fixture.date);
        const time = timeRadio(pageA, third.startsAt);
        await time.click();
        await pageA.getByRole('button', { name: 'Review booking' }).click();
        await expect(reviewDialog(pageA)).toContainText('No dietary needs or allergies for this booking.');
        const { status, booking } = await confirm(pageA);
        expect(status).toBe(201);
        expect(booking.requirements).toEqual([]);

        const first = await waitForEmail(request, hikerA.email, 2);
        const emailsOfA = await emailsTo(request, hikerA.email);
        const texts = await Promise.all(emailsOfA.map(async ({ ID }) => (await readEmail(request, ID)).Text));
        const withNeeds = texts.filter((t) => t.includes('Dietary needs:'));
        const without = texts.filter((t) => !t.includes('Dietary needs'));
        expect(first.count).toBe(2);
        expect(withNeeds).toHaveLength(1);
        expect(withNeeds[0]).toContain('Vegan');
        expect(withNeeds[0]).not.toContain('Gluten');
        expect(without).toHaveLength(1);
        expect(without[0]).not.toContain('Vegan');

        const emailB = await waitForEmail(request, hikerB.email);
        expect(emailB.count).toBe(1);
        expect(emailB.Text).toContain('Gluten');
        expect(emailB.Text).not.toContain('Vegan');

        await pageA.goto('/bookings');
        await expect(pageA.getByText('Vegan')).toBeVisible();
        await expect(pageA.getByText('Gluten')).toHaveCount(0);
        await pageB.goto('/bookings');
        await expect(pageB.getByText('Gluten')).toBeVisible();
        await expect(pageB.getByText('Vegan')).toHaveCount(0);
      } finally {
        await contextA.close();
        await contextB.close();
      }
    });

    // The first hiker reviews a booking with needs; before Confirm, another hiker takes seats.
    test('Scenario 13: a booking refused because the tables changed keeps the needs and sends no email', async ({ page, request }) => {
      // Two tables of two: the party of two is proposed at table 1; the other hiker takes it, table 2 is left.
      fixture = await createFixture([2, 2]);
      const hiker = await createHiker(request);
      const other = await createHiker(request);

      await openReview(page, hiker, { people: 2 });
      await addLine(page, { guests: 2, allergies: ['Peanuts'] });

      await apiLogin(request, other);
      const taken = await request.post('/api/bookings', { data: { slotId: fixture.slotId, partySize: 2, tables: [{ tableNumber: 1, seats: 2 }] } });
      expect(taken.status()).toBe(201);

      const { status, booking } = await confirm(page);

      expect(status).toBe(409);
      expect(booking.code).toBe('TABLES_CHANGED');
      await expect(reviewDialog(page)).toContainText('The free tables changed just now. Check where your party sits and confirm again.');
      await expect(rows(page)).toHaveCount(1);
      await expect(rows(page).first()).toContainText('2 guests');
      await expect(rows(page).first()).toContainText('Peanuts');
      expect(await savedNeedsCount(fixture.slotId)).toBe(0);
      await page.waitForTimeout(NO_EMAIL_WINDOW_MS);
      expect(await emailsTo(request, hiker.email)).toEqual([]);
      // The email of the other hiker did arrive, so Mailpit was receiving.
      expect((await waitForEmail(request, other.email)).count).toBe(1);

      // Confirming again, at the new tables, saves the needs.
      const again = await confirm(page);
      expect(again.status).toBe(201);
      expect(again.booking.requirements).toHaveLength(2);
      expect(await savedNeedsCount(fixture.slotId)).toBe(2);
    });

    test('Scenario 13: a booking refused because the seats are gone saves no needs, sends no email and keeps the draft', async ({ page, request }) => {
      fixture = await createFixture([2]);
      const another = await addSlot([2]);
      const hiker = await createHiker(request);
      const other = await createHiker(request);

      await openReview(page, hiker, { people: 2 });
      await addLine(page, { guests: 2, allergies: ['Peanuts'] });

      await apiLogin(request, other);
      const taken = await request.post('/api/bookings', { data: { slotId: fixture.slotId, partySize: 2, tables: [{ tableNumber: 1, seats: 2 }] } });
      expect(taken.status()).toBe(201);

      const { status, booking } = await confirm(page);

      expect(status).toBe(409);
      expect(booking.code).toBe('NO_SEATS');
      await expect(page.getByText(/Those seats were just taken/)).toBeVisible();
      await expect(reviewDialog(page)).toHaveCount(0);
      expect(await savedNeedsCount(fixture.slotId)).toBe(0);
      await expectNoEmail(request, hiker.email);
      expect((await waitForEmail(request, other.email)).count).toBe(1);

      // The hiker chooses the other slot and reviews again: the needs typed before are still there.
      const time = timeRadio(page, another.startsAt);
      await time.click();
      await expect(time).toHaveAttribute('aria-checked', 'true');
      await page.getByRole('button', { name: 'Review booking' }).click();
      await expect(reviewDialog(page)).toBeVisible();
      await expect(rows(page)).toHaveCount(1);
      await expect(rows(page).first()).toContainText('2 guests');
      await expect(rows(page).first()).toContainText('Peanuts');
      await expect(counter(page)).toContainText('2 of 2');

      // Confirming there saves the needs, and the refused slot still has none.
      const again = await confirm(page);
      expect(again.status).toBe(201);
      expect(again.booking.requirements).toHaveLength(2);
      expect(await savedNeedsCount(another.slotId)).toBe(2);
      expect(await savedNeedsCount(fixture.slotId)).toBe(0);
    });
  });

  test('Scenario 14: the same hiker can book again after a refusal for wrong needs', async ({ request }) => {
    fixture = await createFixture([4]);
    const hiker = await createHiker(request);
    await apiLogin(request, hiker);

    const refused = await apiBook(request, fixture.slotId, 3, [{ diets: ['VEGAN'] }, { allergies: ['EGGS'] }, { diets: ['KETO'] }]);

    expect(refused.status).toBe(400);
    expect(refused.body).toEqual({
      error: 'ValidationError',
      message: 'diets can contain only VEGETARIAN, VEGAN, PESCATARIAN, LACTOSE_FREE',
    });
    expect(await bookingCount(fixture.slotId)).toBe(0);
    expect(await savedNeedsCount(fixture.slotId)).toBe(0);
    const seating = await (await request.get(`/api/slots/${fixture.slotId}/seating`, { params: { partySize: 4 } })).json();
    expect(seating.tables.map((t) => t.seats)).toEqual([4]);
    if (mailpit) await expectNoEmail(request, hiker.email);

    const accepted = await apiBook(request, fixture.slotId, 3, [{ diets: ['VEGAN'] }, { allergies: ['EGGS'] }, { diets: ['VEGETARIAN'] }]);
    expect(accepted.status).toBe(201);
    expect(await savedNeedsCount(fixture.slotId)).toBe(3);
  });
});
