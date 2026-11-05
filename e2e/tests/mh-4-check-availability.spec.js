// E2E tests of MH-04 (check availability): a public search on the home page opens Book a table
// with the matching staff-defined slot and shows where the party can sit.
import { expect, test } from '@playwright/test';

if (process.env.E2E_DATABASE_URL) process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
const { close, get, run } = await import('../../server/src/dao/db.js');
const slots = await import('../../server/src/dao/slots.js');
const tableSets = await import('../../server/src/dao/tableSets.js');
const users = await import('../../server/src/dao/users.js');
const { hash } = await import('../../server/src/passwordHasher.js');

const runId = `${process.pid}-${Date.now()}`;
const password = 'quota-e2e-2026';
let fixture;

const romeDayFromToday = (offset) => {
  const date = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

async function findEmptyFutureDay() {
  for (let offset = 3; offset <= 60; offset += 1) {
    const date = romeDayFromToday(offset);
    const { count } = await get(
      'SELECT COUNT(*)::INTEGER AS count FROM slot WHERE service_date = $1',
      [date],
    );
    if (count === 0) return date;
  }
  throw new Error('No empty future day is available for the MH-4 E2E fixture');
}

async function createFixture(
  capacities,
  bookedSeats = [],
  alternativeCapacities = [],
  alternativeTimes = { startsAt: '14:00', endsAt: '15:00' },
) {
  const date = await findEmptyFutureDay();
  const tableSetId = await tableSets.insert({
    name: `E2E MH-4 ${runId} ${capacities.join('-')}`,
    tables: capacities.map((capacity, index) => ({ tableNumber: index + 1, capacity })),
  });
  const created = await slots.insert({
    serviceDate: date,
    startsAt: '12:00',
    endsAt: '13:00',
    tableSetId,
  });
  let hikerId = null;
  if (bookedSeats.length > 0) {
    ({ id: hikerId } = await get(
      `INSERT INTO app_user (first_name, last_name, email, role, password_hash)
       VALUES ('E2E', 'Occupant', $1, 'HIKER', 'x') RETURNING id`,
      [`e2e-mh4-occupant-${runId}@example.com`],
    ));
    const { id: bookingId } = await get(
      `INSERT INTO booking (slot_id, table_set_id, hiker_id, party_size)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [created.slotId, tableSetId, hikerId, bookedSeats.reduce((sum, seats) => sum + seats, 0)],
    );
    const tables = await run(
      'SELECT id FROM hut_table WHERE table_set_id = $1 ORDER BY table_number',
      [tableSetId],
    );
    for (const [index, seatCount] of bookedSeats.entries()) {
      await run(
        `INSERT INTO booking_table (booking_id, slot_id, table_set_id, hut_table_id, seat_count)
         VALUES ($1, $2, $3, $4, $5)`,
        [bookingId, created.slotId, tableSetId, tables.rows[index].id, seatCount],
      );
    }
  }
  const tableSetIds = [tableSetId];
  const slotIds = [created.slotId];
  if (alternativeCapacities.length > 0) {
    const alternativeSetId = await tableSets.insert({
      name: `E2E MH-4 alternative ${runId}`,
      tables: alternativeCapacities.map((capacity, index) => ({ tableNumber: index + 1, capacity })),
    });
    const alternative = await slots.insert({
      serviceDate: date,
      startsAt: alternativeTimes.startsAt,
      endsAt: alternativeTimes.endsAt,
      tableSetId: alternativeSetId,
    });
    tableSetIds.push(alternativeSetId);
    slotIds.push(alternative.slotId);
  }
  return { date, tableSetId, tableSetIds, slotId: created.slotId, slotIds, hikerId, emails: [] };
}

async function createUnassignedFixture() {
  const date = await findEmptyFutureDay();
  const created = await slots.insert({
    serviceDate: date,
    startsAt: '12:00',
    endsAt: '13:00',
    tableSetId: null,
  });
  return {
    date,
    tableSetId: null,
    tableSetIds: [],
    slotId: created.slotId,
    slotIds: [created.slotId],
    hikerId: null,
    emails: [],
  };
}

async function cleanupFixture() {
  if (!fixture) return;
  await run('DELETE FROM booking WHERE slot_id = ANY($1::INTEGER[])', [fixture.slotIds]);
  await run('DELETE FROM slot WHERE id = ANY($1::INTEGER[])', [fixture.slotIds]);
  await run('DELETE FROM hut_table WHERE table_set_id = ANY($1::INTEGER[])', [fixture.tableSetIds]);
  await run('DELETE FROM table_set WHERE id = ANY($1::INTEGER[])', [fixture.tableSetIds]);
  if (fixture.hikerId !== null) await run('DELETE FROM app_user WHERE id = $1', [fixture.hikerId]);
  if (fixture.emails.length > 0) {
    await run('DELETE FROM app_user WHERE email = ANY($1::TEXT[])', [fixture.emails]);
  }
  fixture = undefined;
}

async function chooseTime(page, label, hour, minute) {
  await page.getByRole('button', { name: label, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `Choose ${label.toLowerCase()} time` });
  await dialog.getByLabel(`${label} hour`).selectOption(hour);
  await dialog.getByLabel(`${label} minute`).selectOption(minute);
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toBeHidden();
}

async function createHiker(request) {
  const email = `e2e-mh4-hiker-${runId}-${fixture.emails.length}@example.com`;
  const response = await request.post('/api/auth/register', {
    data: { firstName: 'E2E', lastName: 'Hiker', email, phone: '', password },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  fixture.emails.push(email);
  return { email, password };
}

async function createEmployee() {
  const email = `e2e-mh4-employee-${runId}-${fixture.emails.length}@example.com`;
  await users.insert({
    firstName: 'E2E',
    lastName: 'Employee',
    email,
    phone: null,
    role: 'EMPLOYEE',
    passwordHash: await hash(password),
  });
  fixture.emails.push(email);
  return { email, password };
}

async function login(page, user) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByRole('textbox', { name: 'Password' }).fill(user.password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

async function searchFromHome(page, people, from = ['11', '30'], to = ['13', '30']) {
  await page.goto('/');
  await page.getByLabel('Day', { exact: true }).fill(fixture.date);
  await page.getByLabel('People', { exact: true }).fill(String(people));
  await chooseTime(page, 'From', ...from);
  await chooseTime(page, 'To', ...to);
  await page.getByRole('button', { name: 'Check availability' }).click();
}

test.describe('MH-4 Check availability', () => {
  test.beforeEach(async ({}, testInfo) => {
    if (testInfo.title.includes('no table set')) fixture = await createUnassignedFixture();
    else if (testInfo.title.includes('every seat')) fixture = await createFixture([2], [2]);
    else if (testInfo.title.includes('only one overlapping')) {
      fixture = await createFixture([2], [], [3], { startsAt: '12:30', endsAt: '13:30' });
    }
    else if (testInfo.title.includes('several times')) {
      fixture = await createFixture([4, 6], [], [3], { startsAt: '12:30', endsAt: '13:30' });
    }
    else if (testInfo.title.includes('does not book')) fixture = await createFixture([6]);
    else if (testInfo.title.includes('employee gets')) fixture = await createFixture([4]);
    else if (testInfo.title.includes('different time')) fixture = await createFixture([5], [], [6]);
    else if (testInfo.title.includes('bigger than')) fixture = await createFixture([5], [], [6]);
    else if (testInfo.title.includes('still free')) fixture = await createFixture([4, 4, 4], [2, 1, 3]);
    else if (testInfo.title.includes('split over tables')) fixture = await createFixture([2, 2, 2]);
    else fixture = await createFixture([4, 6]);
  });

  test.afterEach(async () => {
    await cleanupFixture();
  });

  test.afterAll(async () => {
    await close();
  });

  test('a visitor checks a party that fits at one table', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await expect.poll(async () => (await page.context().cookies()).some(({ name }) => name === 'sid')).toBe(false);

    await page.getByLabel('Day', { exact: true }).fill(fixture.date);
    await page.getByLabel('People', { exact: true }).fill('3');
    await chooseTime(page, 'From', '11', '30');
    await chooseTime(page, 'To', '13', '30');
    await page.getByRole('button', { name: 'Check availability' }).click();

    await expect(page).toHaveURL(/\/book\?/);
    expect(page.url()).not.toMatch(/\/login/);
    const choices = new URL(page.url()).searchParams;
    expect(choices.get('date')).toBe(fixture.date);
    expect(choices.get('people')).toBe('3');
    expect(choices.get('from')).toBe('11:30');
    expect(choices.get('to')).toBe('13:30');

    await expect(page.getByRole('heading', { level: 1, name: 'Book a table' })).toBeVisible();
    const selectedSlot = page.getByRole('radio', { name: /12:00/ });
    await expect(selectedSlot).toHaveCount(1);
    await expect(selectedSlot).toHaveAttribute('aria-checked', 'true');

    const answer = page.getByRole('status', { name: 'Table availability' });
    await expect(answer.getByText('Available', { exact: true })).toBeVisible();
    await expect(answer.getByText('3 seats', { exact: true })).toBeVisible();
    await expect(answer.getByText('1 table', { exact: true })).toBeVisible();
    await expect(answer.getByText('3 at table 1', { exact: true })).toBeVisible();

    expect((await get('SELECT COUNT(*)::INTEGER AS count FROM booking WHERE slot_id = $1', [fixture.slotId])).count)
      .toBe(0);
  });

  test('a party that fits only when split over tables is available', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');

    await page.getByLabel('Day', { exact: true }).fill(fixture.date);
    await page.getByLabel('People', { exact: true }).fill('6');
    await chooseTime(page, 'From', '11', '30');
    await chooseTime(page, 'To', '13', '30');
    await page.getByRole('button', { name: 'Check availability' }).click();

    await expect(page).toHaveURL(/\/book\?/);
    const selectedSlot = page.getByRole('radio', { name: /12:00/ });
    await expect(selectedSlot).toHaveCount(1);
    await expect(selectedSlot).toHaveAttribute('aria-checked', 'true');

    const answer = page.getByRole('status', { name: 'Table availability' });
    await expect(answer.getByText('Available', { exact: true })).toBeVisible();
    await expect(answer.getByText('2 + 2 + 2 seats', { exact: true })).toBeVisible();
    await expect(answer.getByText('3 tables', { exact: true })).toBeVisible();
    await expect(answer.getByText(/2 at table 1.*2 at table 2.*2 at table 3/)).toBeVisible();

    expect((await get('SELECT COUNT(*)::INTEGER AS count FROM booking WHERE slot_id = $1', [fixture.slotId])).count)
      .toBe(0);
  });

  test('the detail follows the seats that are still free', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');

    await page.getByLabel('Day', { exact: true }).fill(fixture.date);
    await page.getByLabel('People', { exact: true }).fill('6');
    await chooseTime(page, 'From', '11', '30');
    await chooseTime(page, 'To', '13', '30');
    await page.getByRole('button', { name: 'Check availability' }).click();

    await expect(page).toHaveURL(/\/book\?/);
    const answer = page.getByRole('status', { name: 'Table availability' });
    await expect(answer.getByText('Available', { exact: true })).toBeVisible();
    await expect(answer.getByText('2 + 3 + 1 seats', { exact: true })).toBeVisible();
    await expect(answer.getByText('3 tables', { exact: true })).toBeVisible();
    await expect(answer.getByText(/2 at table 1.*3 at table 2.*1 at table 3/)).toBeVisible();

    expect((await get('SELECT COUNT(*)::INTEGER AS count FROM booking WHERE slot_id = $1', [fixture.slotId])).count)
      .toBe(1);
  });

  test('a party bigger than the free seats is not available', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');

    await page.getByLabel('Day', { exact: true }).fill(fixture.date);
    await page.getByLabel('People', { exact: true }).fill('6');
    await chooseTime(page, 'From', '11', '30');
    await chooseTime(page, 'To', '13', '30');
    await page.getByRole('button', { name: 'Check availability' }).click();

    await expect(page).toHaveURL(/\/book\?/);
    const target = page.getByRole('radio', { name: /12:00/ });
    await target.click();
    await expect(target).toHaveAttribute('aria-checked', 'true');

    const answer = page.getByRole('status', { name: 'Table availability' });
    await expect(answer.getByText('Not available', { exact: true })).toBeVisible();
    await expect(answer).toContainText('This time has 5 free seats, not enough for 6 people.');
    await expect(answer).not.toContainText('14:00');
    await expect(answer).not.toContainText('another time');

    const summary = page.getByRole('complementary', { name: 'Your booking' });
    await expect(summary.getByRole('button', { name: 'Review booking' })).toBeDisabled();
    await expect(page.getByRole('radio', { name: /14:00/ })).toBeVisible();
  });

  const checkNoFreeSeats = async (page, expectedBookingCount) => {
    await page.context().clearCookies();
    await page.goto('/');

    await page.getByLabel('Day', { exact: true }).fill(fixture.date);
    await page.getByLabel('People', { exact: true }).fill('1');
    await chooseTime(page, 'From', '11', '30');
    await chooseTime(page, 'To', '13', '30');
    await page.getByRole('button', { name: 'Check availability' }).click();

    await expect(page).toHaveURL(/\/book\?/);
    const timeGroup = page.getByRole('radiogroup', { name: 'Time' });
    await expect(timeGroup.getByRole('radio')).toHaveCount(1);
    await timeGroup.getByRole('radio', { name: /12:00/ }).click();

    const answer = page.getByRole('status', { name: 'Table availability' });
    await expect(answer.getByText('Not available', { exact: true })).toBeVisible();
    await expect(answer).toContainText('This time has no free seats.');
    await expect(answer).not.toContainText('another time');
    await expect(page.getByRole('complementary', { name: 'Your booking' })
      .getByRole('button', { name: 'Review booking' })).toBeDisabled();

    expect((await get('SELECT COUNT(*)::INTEGER AS count FROM booking WHERE slot_id = $1', [fixture.slotId])).count)
      .toBe(expectedBookingCount);
  };

  test('a slot whose every seat is already booked is not available', async ({ page }) => {
    await checkNoFreeSeats(page, 1);
  });

  test('a slot with no table set is not available', async ({ page }) => {
    await checkNoFreeSeats(page, 0);
  });

  test('after not available the user checks a different time', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');

    await page.getByLabel('Day', { exact: true }).fill(fixture.date);
    await page.getByLabel('People', { exact: true }).fill('6');
    await chooseTime(page, 'From', '11', '30');
    await chooseTime(page, 'To', '13', '30');
    await page.getByRole('button', { name: 'Check availability' }).click();

    const firstTime = page.getByRole('radio', { name: /12:00/ });
    await firstTime.click();
    const answer = page.getByRole('status', { name: 'Table availability' });
    await expect(answer.getByText('Not available', { exact: true })).toBeVisible();
    await expect(answer).toContainText('This time has 5 free seats, not enough for 6 people.');

    const secondTime = page.getByRole('radio', { name: /14:00/ });
    await secondTime.click();
    await expect(secondTime).toHaveAttribute('aria-checked', 'true');
    await expect(firstTime).toHaveAttribute('aria-checked', 'false');
    await expect(answer.getByText('Available', { exact: true })).toBeVisible();
    await expect(answer.getByText('6 seats', { exact: true })).toBeVisible();
    await expect(answer.getByText('1 table', { exact: true })).toBeVisible();
    await expect(answer).not.toContainText('5 free seats');

    const summary = page.getByRole('complementary', { name: 'Your booking' });
    await expect(summary).toContainText('14:00');
    await expect(summary).not.toContainText('12:00');
  });

  test('several times match the search and the user chooses one', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');

    await page.getByLabel('Day', { exact: true }).fill(fixture.date);
    await page.getByLabel('People', { exact: true }).fill('3');
    await chooseTime(page, 'From', '11', '30');
    await chooseTime(page, 'To', '13', '30');
    await page.getByRole('button', { name: 'Check availability' }).click();

    await expect(page).toHaveURL(/\/book\?/);
    const timeGroup = page.getByRole('radiogroup', { name: 'Time' });
    await expect(timeGroup.getByRole('radio')).toHaveCount(2);
    await expect(timeGroup.locator('[role="radio"][aria-checked="true"]')).toHaveCount(0);

    const answer = page.getByRole('status', { name: 'Table availability' });
    await expect(answer).toContainText('2 overlapping slots are currently bookable for 3 people. Choose one to check availability.');
    await expect(answer.getByText('Available', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('complementary', { name: 'Your booking' })
      .getByRole('button', { name: 'Review booking' })).toBeDisabled();

    const chosen = timeGroup.getByRole('radio', { name: /12:30/ });
    await chosen.click();
    await expect(chosen).toHaveAttribute('aria-checked', 'true');
    await expect(answer.getByText('Available', { exact: true })).toBeVisible();
    await expect(answer.getByText('3 seats', { exact: true })).toBeVisible();
    await expect(answer.getByText('1 table', { exact: true })).toBeVisible();
  });

  test('only one overlapping slot has enough free seats', async ({ page }) => {
    await page.context().clearCookies();
    await searchFromHome(page, 3);

    await expect(page).toHaveURL(/\/book\?/);
    const insufficient = page.getByRole('radio', { name: /12:00/ });
    const fitting = page.getByRole('radio', { name: /12:30/ });
    await expect(insufficient).toBeVisible();
    await expect(insufficient).toContainText('Only 2 seats free');
    await expect(insufficient).toHaveAttribute('aria-checked', 'false');
    await expect(fitting).toHaveAttribute('aria-checked', 'true');

    const answer = page.getByRole('status', { name: 'Table availability' });
    await expect(answer.getByText('Available', { exact: true })).toBeVisible();
    await expect(answer.getByText('3 seats', { exact: true })).toBeVisible();
    await expect(answer.getByText('1 table', { exact: true })).toBeVisible();
  });

  test('no time matches the search', async ({ page }) => {
    await page.context().clearCookies();
    await searchFromHome(page, 2, ['15', '00'], ['16', '00']);

    await expect(page).toHaveURL(/\/book\?/);
    const timeGroup = page.getByRole('radiogroup', { name: 'Time' });
    await expect(timeGroup.locator('[role="radio"][aria-checked="true"]')).toHaveCount(0);
    const answer = page.getByRole('status', { name: 'Table availability' });
    await expect(answer.getByText('Not available', { exact: true })).toBeVisible();
    await expect(answer).toContainText(
      /No meal slots overlap your selected time range \(15:00.*16:00\) on this day\./,
    );
    await expect(answer).not.toContainText('12:00');
    await expect(page.getByRole('complementary', { name: 'Your booking' })
      .getByRole('button', { name: 'Review booking' })).toBeDisabled();
  });

  test('the search needs From and To', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await page.getByLabel('Day', { exact: true }).fill(fixture.date);
    await page.getByLabel('People', { exact: true }).fill('2');

    await expect(page.getByRole('button', { name: 'From', exact: true })).toContainText('Choose');
    await expect(page.getByRole('button', { name: 'To', exact: true })).toContainText('Choose');
    const check = page.getByRole('button', { name: 'Check availability' });
    await expect(check).toBeDisabled();

    await chooseTime(page, 'From', '11', '30');
    await chooseTime(page, 'To', '13', '30');
    await expect(page.getByRole('button', { name: 'From', exact: true })).toContainText('11:30');
    await expect(page.getByRole('button', { name: 'To', exact: true })).toContainText('13:30');
    await expect(check).toBeEnabled();
  });

  test('the availability check does not book', async ({ page, request }) => {
    const hiker = await createHiker(request);
    await login(page, hiker);
    await expect(page).toHaveURL(/\/book/);

    await searchFromHome(page, 6);
    let answer = page.getByRole('status', { name: 'Table availability' });
    await expect(answer.getByText('Available', { exact: true })).toBeVisible();
    await expect(answer.getByText('6 seats', { exact: true })).toBeVisible();
    expect((await get('SELECT COUNT(*)::INTEGER AS count FROM booking WHERE slot_id = $1', [fixture.slotId])).count)
      .toBe(0);

    await page.getByRole('link', { name: 'Change search' }).click();
    await page.getByRole('button', { name: 'Check availability' }).click();
    answer = page.getByRole('status', { name: 'Table availability' });
    await expect(answer.getByText('Available', { exact: true })).toBeVisible();
    await expect(answer.getByText('6 seats', { exact: true })).toBeVisible();
    expect((await get('SELECT COUNT(*)::INTEGER AS count FROM booking WHERE slot_id = $1', [fixture.slotId])).count)
      .toBe(0);
  });

  test('an employee gets the same answer', async ({ page }) => {
    const employee = await createEmployee();
    await login(page, employee);
    await expect(page).toHaveURL(/\/slots/);

    await searchFromHome(page, 3);
    const answer = page.getByRole('status', { name: 'Table availability' });
    await expect(answer.getByText('Available', { exact: true })).toBeVisible();
    await expect(answer.getByText('3 seats', { exact: true })).toBeVisible();
    await expect(answer.getByText('1 table', { exact: true })).toBeVisible();
    await expect(answer.getByText('3 at table 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Only hikers can book.', { exact: true })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Your booking' })
      .getByRole('button', { name: 'Review booking' })).toBeDisabled();
  });
});
