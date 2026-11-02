import { expect, test } from '@playwright/test';

if (process.env.E2E_DATABASE_URL) process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
const { close, inTransaction, run } = await import('../../server/src/dao/db.js');

const password = 'quota-e2e-2026';
let fixture;
//
const longDayLabel = (date) => {
  const value = new Date(`${date}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).formatToParts(value);
  const fields = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${fields.weekday} ${fields.day} ${fields.month} ${fields.year}`;
};

const shortDayLabel = (date) => {
  const value = new Date(`${date}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).formatToParts(value);
  const fields = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${fields.weekday} ${fields.day} ${fields.month}`;
};

const localDateTime = (offsetMinutes) => {
  const date = new Date(Date.now() + offsetMinutes * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}:${values.second}`,
  };
};

async function createFixture(testTitle) {
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const targetSetName = `E2E MH-1 target ${suffix}`;
  const capacitySetName = `E2E MH-1 capacity ${suffix}`;
  const open = localDateTime(240);
  const capacity = localDateTime(300);
  const closed = localDateTime(60);
  const target = testTitle.includes('less than') ? closed : open;

  return inTransaction(async () => {
    const targetSet = await run('INSERT INTO table_set (name) VALUES ($1) RETURNING id', [targetSetName]);
    const capacitySet = await run('INSERT INTO table_set (name) VALUES ($1) RETURNING id', [capacitySetName]);
    const targetSetId = targetSet.rows[0].id;
    const capacitySetId = capacitySet.rows[0].id;
    const targetTable = await run(
      `INSERT INTO hut_table (table_set_id, table_number, seat_capacity)
       VALUES ($1, 1, 2) RETURNING id`,
      [targetSetId],
    );
    const capacityTable = await run(
      `INSERT INTO hut_table (table_set_id, table_number, seat_capacity)
       VALUES ($1, 1, 3) RETURNING id`,
      [capacitySetId],
    );

    const targetSlot = await run(
      `INSERT INTO slot (service_date, starts_at, ends_at, table_set_id)
       VALUES ($1, $2, ($2::time + interval '1 hour')::time, $3)
       RETURNING id`,
      [target.date, target.time, targetSetId],
    );
    const capacitySlot = await run(
      `INSERT INTO slot (service_date, starts_at, ends_at, table_set_id)
       VALUES ($1, $2, ($2::time + interval '1 hour')::time, $3)
       RETURNING id`,
      [capacity.date, capacity.time, capacitySetId],
    );

    return {
      tableSetIds: [targetSetId, capacitySetId],
      tableIds: [targetTable.rows[0].id, capacityTable.rows[0].id],
      slotIds: [targetSlot.rows[0].id, capacitySlot.rows[0].id],
      date: target.date,
      startsAt: target.time,
      emails: [],
    };
  });
}

async function cleanupFixture() {
  if (!fixture) return;
  await inTransaction(async () => {
    await run('DELETE FROM booking WHERE slot_id = ANY($1::int[])', [fixture.slotIds]);
    await run('DELETE FROM slot WHERE id = ANY($1::int[])', [fixture.slotIds]);
    await run('DELETE FROM hut_table WHERE id = ANY($1::int[])', [fixture.tableIds]);
    await run('DELETE FROM table_set WHERE id = ANY($1::int[])', [fixture.tableSetIds]);
    if (fixture.emails.length > 0) {
      await run('DELETE FROM app_user WHERE email = ANY($1::text[])', [fixture.emails]);
    }
  });
  fixture = undefined;
}

const uniqueHiker = () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    firstName: 'E2E',
    lastName: 'Hiker',
    email: `e2e-${suffix}@example.com`,
    phone: '',
    password,
  };
};

async function createHiker(request) {
  const hiker = uniqueHiker();
  const response = await request.post('/api/auth/register', { data: hiker });
  expect(response.ok(), await response.text()).toBeTruthy();
  fixture?.emails.push(hiker.email);
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
  const day = page.locator('button[role="radio"]').filter({
    hasText: new RegExp(`(?:^|\\D)${dayNumber}(?:\\D|$)`),
  }).first();
  await day.click();
}

async function chooseSlot(page, startsAt) {
  const displayedStart = startsAt.slice(0, 5);
  const escapedStart = displayedStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const slot = page.getByRole('radio', { name: new RegExp(escapedStart) });
  await expect(slot).toHaveCount(1);
  await expect(slot).toBeEnabled();
  await slot.click();
  await expect(slot).toHaveAttribute('aria-checked', 'true');
}

test.describe('MH-1 Book a table', () => {
  test.beforeEach(async ({}, testInfo) => {
    fixture = await createFixture(testInfo.title);
  });

  test.afterEach(async () => {
    await cleanupFixture();
  });

  test.afterAll(async () => {
    await close();
  });

  test('a hiker books a table successfully', async ({ page, request }) => {
    const hiker = await createHiker(request);
    const available = { date: fixture.date, startsAt: fixture.startsAt };

    await login(page, hiker);
    await page.goto('/book');
    await chooseDay(page, available.date);
    await page.getByRole('button', { name: 'One more' }).click();

    await chooseSlot(page, available.startsAt);
    await page.getByRole('button', { name: 'Review booking' }).click();

    const review = page.getByRole('dialog');
    await expect(review).toContainText('Check your booking');
    await expect(review).toContainText(longDayLabel(available.date));
    await expect(review).toContainText(available.startsAt.slice(0, 5));
    await expect(review).toContainText('2');
    await expect(review).toContainText('table 1');

    const bookingResponse = page.waitForResponse(
      (response) => response.url().endsWith('/api/bookings') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Confirm booking' }).click();
    await expect((await bookingResponse).status()).toBe(201);

    await expect(page.getByRole('heading', { name: 'Table booked' })).toBeVisible();
    await expect(page.getByText(shortDayLabel(available.date))).toBeVisible();
    await expect(page.getByText(available.startsAt.slice(0, 5))).toBeVisible();
    await expect(page.getByText('in your party')).toBeVisible();
    await expect(page.getByText('in your party').locator('..').getByText('2', { exact: true })).toBeVisible();
    await expect(page.getByText('table 1')).toBeVisible();
  });

  test('a party bigger than the free seats cannot select the time', async ({ page, request }) => {
    const hiker = await createHiker(request);
    let bookingRequests = 0;
    page.on('request', (requestEvent) => {
      if (requestEvent.method() === 'POST' && requestEvent.url().endsWith('/api/bookings')) bookingRequests += 1;
    });
    const available = { date: fixture.date, startsAt: fixture.startsAt };

    await login(page, hiker);
    await page.goto('/book');
    await chooseDay(page, available.date);
    await page.getByRole('button', { name: 'One more' }).click();
    await page.getByRole('button', { name: 'One more' }).click();

    const time = page.getByRole('radio', { name: new RegExp(available.startsAt.slice(0, 5)) });
    await expect(time).toBeDisabled();
    await expect(time).toContainText('Only 2 seats free');
    await expect(page.getByRole('button', { name: 'Review booking' })).toBeDisabled();
    expect(bookingRequests).toBe(0);
  });

  test('a time less than two hours before the meal cannot be selected', async ({ page, request }) => {
    const hiker = await createHiker(request);
    let bookingRequests = 0;
    page.on('request', (requestEvent) => {
      if (requestEvent.method() === 'POST' && requestEvent.url().endsWith('/api/bookings')) bookingRequests += 1;
    });
    const closed = { date: fixture.date, startsAt: fixture.startsAt };

    await login(page, hiker);
    await page.goto('/book');
    await chooseDay(page, closed.date);
    await page.getByRole('button', { name: 'One more' }).click();

    const time = page.getByRole('radio', { name: new RegExp(closed.startsAt.slice(0, 5)) });
    await expect(time).toBeDisabled();
    await expect(time).toContainText(/Closed at/);
    await expect(page.getByRole('button', { name: 'Review booking' })).toBeDisabled();
    expect(bookingRequests).toBe(0);
  });

  test('a user who is not logged in is sent to the login page', async ({ page, request }) => {
    const hiker = await createHiker(request);
    await page.context().clearCookies();
    await page.goto('/book');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('Log in to book a table.')).toBeVisible();
    await page.getByLabel('Email').fill(hiker.email);
    await page.getByRole('textbox', { name: 'Password' }).fill(hiker.password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/book/);
    await chooseDay(page, fixture.date);
  });
});
