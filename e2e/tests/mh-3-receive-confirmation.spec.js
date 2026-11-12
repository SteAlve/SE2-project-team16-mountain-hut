// MH-3 Receive confirmation: the scenarios of docs/e2e-definitions/MH-3-receive-confirmation-e2e-scenarios.md.
// The server sends its emails to Mailpit (SMTP_HOST and SMTP_PORT), and the tests read them
// through the Mailpit API at MAILPIT_URL. Without MAILPIT_URL these tests are skipped.
import { expect, test } from '@playwright/test';

if (process.env.E2E_DATABASE_URL) process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
const { close, inTransaction, run } = await import('../../server/src/dao/db.js');

const mailpit = process.env.MAILPIT_URL;
const password = 'quota-e2e-2026';
// How long the tests wait for an email, and how long they make sure none arrives.
const EMAIL_TIMEOUT_MS = 10_000;
const NO_EMAIL_WINDOW_MS = 3_000;
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

let fixture;

// Tomorrow in the time zone of the hut: always more than two hours away, and in the day strip.
const tomorrowInRome = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' })
  .format(new Date(Date.now() + 24 * 60 * 60 * 1000));

// A start time between 10:00 and 11:59, so two runs do not meet on the same slot; the meal ends
// two hours later, on the same day.
const randomLunchTime = () => {
  const minutes = 10 * 60 + Math.floor(Math.random() * 120);
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
  return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`;
};

// 'YYYY-MM-DD' -> '4 November 2026', as in the email
const emailDay = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
};

const reference = (bookingId) => `QUOTA-${String(bookingId).padStart(5, '0')}`;

// A table set with tables of the given seats.
async function createTableSet(seats) {
  const set = await run('INSERT INTO table_set (name) VALUES ($1) RETURNING id', [
    `E2E MH-3 ${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  ]);
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

// The slot of the test, tomorrow, with tables of the given seats. With biggerSeats, a second slot
// the same day, three hours later: the people stepper stops at the largest party of the day, so
// a party too big for the first slot needs a day where it fits elsewhere.
async function createFixture(seats, biggerSeats) {
  const date = tomorrowInRome();
  const startsAt = randomLunchTime();
  return inTransaction(async () => {
    const tableSetIds = [await createTableSet(seats)];
    const slotIds = [await createSlot(date, startsAt, tableSetIds[0])];
    if (biggerSeats) {
      tableSetIds.push(await createTableSet(biggerSeats));
      const later = `${String(Number(startsAt.slice(0, 2)) + 3).padStart(2, '0')}${startsAt.slice(2)}`;
      slotIds.push(await createSlot(date, later, tableSetIds[1]));
    }
    return { tableSetIds, slotIds, slotId: slotIds[0], date, startsAt, emails: [] };
  });
}

async function cleanupFixture() {
  if (!fixture) return;
  await inTransaction(async () => {
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
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const hiker = { firstName: 'Mara', lastName: `Rossi ${suffix.slice(-6)}`, email: `e2e-mh3-${suffix}@example.com`, phone: '', password };
  const response = await request.post('/api/auth/register', { data: hiker });
  expect(response.ok(), await response.text()).toBeTruthy();
  fixture.emails.push(hiker.email);
  return hiker;
}

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

// The emails Mailpit holds for an address.
async function emailsTo(request, address) {
  const response = await request.get(`${mailpit}/api/v1/search`, { params: { query: `to:"${address}"` } });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).messages;
}

// Waits for the email of an address and reads it whole: sender, receivers, subject, text and HTML.
async function waitForEmail(request, address) {
  let messages = [];
  await expect.poll(async () => {
    messages = await emailsTo(request, address);
    return messages.length;
  }, { timeout: EMAIL_TIMEOUT_MS }).toBeGreaterThan(0);
  const response = await request.get(`${mailpit}/api/v1/message/${messages[0].ID}`);
  expect(response.ok()).toBeTruthy();
  return { count: messages.length, ...(await response.json()) };
}

// A hiker books a party of two at the time of the fixture and confirms; gives what the booking
// flow shows and what the server answered.
async function bookPartyOfTwo(page, hiker) {
  await login(page, hiker);
  await page.goto('/book');
  await chooseDay(page, fixture.date);
  await page.getByRole('button', { name: 'One more' }).click();
  const time = timeRadio(page, fixture.startsAt);
  await time.click();
  await expect(time).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Review booking' }).click();

  const review = page.getByRole('dialog');
  await expect(review).toContainText('Check your booking');
  await expect(review).toContainText(fixture.startsAt.slice(0, 5));

  const answer = page.waitForResponse((r) => r.url().endsWith('/api/bookings') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirm booking' }).click();
  const response = await answer;
  return { status: response.status(), booking: await response.json() };
}

test.describe('MH-3 Receive confirmation', () => {
  test.skip(!mailpit, 'Set MAILPIT_URL, SMTP_HOST and SMTP_PORT to run these tests against Mailpit.');

  test.afterEach(async () => {
    await cleanupFixture();
  });

  test.afterAll(async () => {
    await close();
  });

  test('a successful booking sends a confirmation email', async ({ page, request }) => {
    fixture = await createFixture([2, 4]);
    const hiker = await createHiker(request);
    expect(await emailsTo(request, hiker.email)).toEqual([]);

    const { status } = await bookPartyOfTwo(page, hiker);

    expect(status).toBe(201);
    await expect(page.getByRole('heading', { name: 'Table booked' })).toBeVisible();
    const email = await waitForEmail(request, hiker.email);
    expect(email.count).toBe(1);
    expect(email.To.map(({ Address }) => Address)).toEqual([hiker.email]);
    expect(email.Text.length).toBeGreaterThan(0);
  });

  test('the confirmation email contains the booked details', async ({ page, request }) => {
    fixture = await createFixture([2, 4]);
    const hiker = await createHiker(request);
    expect(await emailsTo(request, hiker.email)).toEqual([]);

    const { status, booking } = await bookPartyOfTwo(page, hiker);
    expect(status).toBe(201);

    // The values recorded from the booking, compared with the email in text and in HTML.
    const name = `${hiker.firstName} ${hiker.lastName}`;
    const expected = [reference(booking.id), name, emailDay(booking.date), fixture.startsAt.slice(0, 5)];
    const email = await waitForEmail(request, hiker.email);
    const html = email.HTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    expect(email.To.map(({ Address }) => Address)).toEqual([hiker.email]);
    expect(email.Subject).toContain(reference(booking.id));
    for (const value of expected) {
      expect(email.Text).toContain(value);
      expect(html).toContain(value);
    }
    expect(email.Text).toMatch(/Party size:\s*2\b/);
    expect(html).toMatch(/Party size\s+2\b/);
  });

  test('a time too small for the party cannot be booked, and no email is sent', async ({ page, request }) => {
    fixture = await createFixture([2], [4]);
    const hiker = await createHiker(request);
    let bookingRequests = 0;
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/api/bookings')) bookingRequests += 1;
    });

    await login(page, hiker);
    await page.goto('/book');
    await chooseDay(page, fixture.date);
    await page.getByRole('button', { name: 'One more' }).click();
    await page.getByRole('button', { name: 'One more' }).click();

    await expect(timeRadio(page, fixture.startsAt)).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Review booking' })).toBeDisabled();
    await page.waitForTimeout(NO_EMAIL_WINDOW_MS);
    expect(bookingRequests).toBe(0);
    expect(await emailsTo(request, hiker.email)).toEqual([]);
  });

  test('a booking refused because the seats were taken during the review sends no email', async ({ page, request }) => {
    fixture = await createFixture([2]);
    const hiker = await createHiker(request);
    const other = await createHiker(request);

    // The other hiker takes the only table while the first one is still reviewing.
    await login(page, hiker);
    await page.goto('/book');
    await chooseDay(page, fixture.date);
    await page.getByRole('button', { name: 'One more' }).click();
    await timeRadio(page, fixture.startsAt).click();
    await page.getByRole('button', { name: 'Review booking' }).click();
    await expect(page.getByRole('dialog')).toContainText('Check your booking');

    const otherSession = await request.post('/api/auth/login', { data: { email: other.email, password } });
    expect(otherSession.ok()).toBeTruthy();
    const taken = await request.post('/api/bookings', {
      data: { slotId: fixture.slotId, partySize: 2, tables: [{ tableNumber: 1, seats: 2 }] },
    });
    expect(taken.status()).toBe(201);

    const answer = page.waitForResponse((r) => r.url().endsWith('/api/bookings') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Confirm booking' }).click();
    expect((await answer).status()).toBe(409);

    await page.waitForTimeout(NO_EMAIL_WINDOW_MS);
    expect(await emailsTo(request, hiker.email)).toEqual([]);
    // The email of the other hiker did arrive, so Mailpit was receiving.
    expect((await waitForEmail(request, other.email)).count).toBe(1);
  });
});
