// Acceptance tests for docs/e2e-definitions/MH-9-repeat-weekly-schedule-e2e-scenarios.md.
// The schedule fixtures are created directly in the E2E database so every test can use isolated
// periods and can verify the persistence effects that the browser does not expose.
import { expect, test } from '@playwright/test';

if (process.env.E2E_DATABASE_URL) process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
const { close, all, get, run } = await import('../../server/src/dao/db.js');
const slots = await import('../../server/src/dao/slots.js');
const tableSets = await import('../../server/src/dao/tableSets.js');
const users = await import('../../server/src/dao/users.js');
const { hash } = await import('../../server/src/passwordHasher.js');

const PASSWORD = 'quota-e2e-2026';
const RUN_ID = Date.now().toString(36);
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (value) => String(value).padStart(2, '0');
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let sequence = 0;
let fixture;

const toDay = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const addDays = (day, count) => {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + count);
  return toDay(date);
};

const dayLabel = (day) => {
  const date = new Date(`${day}T12:00:00`);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
};

const dayRadioPattern = (day) => {
  const date = new Date(`${day}T12:00:00`);
  return new RegExp(
    `^${WEEKDAYS[date.getDay()]} ${date.getDate()}(?: ${MONTHS[date.getMonth()]})?(?:\\s|$)`,
  );
};

const periodPattern = (from) => new RegExp(
  `${escapeRegex(dayLabel(from))}[\\s\\S]*${escapeRegex(dayLabel(addDays(from, 6)))}`,
);

const count = async (sql, params = []) => Number((await get(sql, params)).count);

// The staff day strip initially shows the next 14 days. Pick a visible non-Monday source whose
// complete five-week test range is empty, instead of colliding with seed data or another spec.
const nextFreeSource = async () => {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  for (let offset = 2; offset < 14; offset += 1) {
    const candidate = new Date(today.getTime());
    candidate.setDate(candidate.getDate() + offset);
    if (candidate.getDay() === 1) continue;
    const sourceStart = toDay(candidate);
    const occupied = await count(
      `SELECT COUNT(*) FROM slot
       WHERE service_date BETWEEN $1::DATE AND $2::DATE`,
      [sourceStart, addDays(sourceStart, 34)],
    );
    if (occupied === 0) return sourceStart;
  }
  throw new Error('No free five-week range is available in the staff day strip');
};

async function createUser({ role, label }) {
  const email = `mh9-${RUN_ID}-${fixture.emails.length}@example.com`;
  await users.insert({
    firstName: label,
    lastName: fixture.prefix,
    email,
    phone: null,
    role,
    passwordHash: await hash(PASSWORD),
  });
  fixture.emails.push(email);
  return { email, password: PASSWORD };
}

async function createTableSet() {
  fixture.tableSetId = await tableSets.insert({
    name: `${fixture.prefix} tables`,
    tables: [{ tableNumber: 1, capacity: 4 }, { tableNumber: 2, capacity: 4 }],
  });
}

async function createSlot(date, startsAt, endsAt, tableSetId = fixture.tableSetId) {
  const created = await slots.insert({ serviceDate: date, startsAt, endsAt, tableSetId });
  expect(created).not.toBeNull();
  fixture.times.push(startsAt);
  return { slotId: created.slotId, date, startsAt, endsAt, tableSetId };
}

async function createSourceSchedule() {
  await createTableSet();
  const minute = String(10 + (fixture.number % 8) * 5).padStart(2, '0');
  fixture.sourceSlots = [
    await createSlot(fixture.sourceStart, `12:${minute}`, `13:${minute}`),
    await createSlot(addDays(fixture.sourceStart, 1), `18:${minute}`, `19:${minute}`),
    await createSlot(addDays(fixture.sourceStart, 2), `20:${minute}`, `21:${minute}`, null),
  ];
  fixture.sourceTimes = [...fixture.times];
}

async function createBooking(slot, cancelled = false) {
  const hiker = await createUser({ role: 'HIKER', label: 'Hiker' });
  const booking = await get(
    `INSERT INTO booking (slot_id, table_set_id, hiker_id, party_size)
     VALUES ($1, $2, $3, 1) RETURNING id`,
    [slot.slotId, slot.tableSetId, (await get('SELECT id FROM app_user WHERE email = $1', [hiker.email])).id],
  );
  const table = await get('SELECT id FROM hut_table WHERE table_set_id = $1 ORDER BY id LIMIT 1', [slot.tableSetId]);
  await run(
    `INSERT INTO booking_table (booking_id, slot_id, table_set_id, hut_table_id, seat_count)
     VALUES ($1, $2, $3, $4, 1)`,
    [booking.id, slot.slotId, slot.tableSetId, table.id],
  );
  if (cancelled) await run('UPDATE booking SET cancelled_at = CURRENT_TIMESTAMP WHERE id = $1', [booking.id]);
  return booking.id;
}

async function cleanup() {
  if (!fixture) return;
  const ownedSlots = await all(
    `SELECT id FROM slot
     WHERE ($1::INTEGER IS NOT NULL AND table_set_id = $1)
        OR (service_date = ANY($2::DATE[]) AND starts_at = ANY($3::TIME[]))`,
    [fixture.tableSetId, fixture.days, fixture.times],
  );
  const slotIds = ownedSlots.map(({ id }) => id);
  if (slotIds.length > 0) {
    await run('DELETE FROM booking WHERE slot_id = ANY($1::INTEGER[])', [slotIds]);
    await run('DELETE FROM slot WHERE id = ANY($1::INTEGER[])', [slotIds]);
  }
  if (fixture.tableSetId !== null) {
    await run('DELETE FROM hut_table WHERE table_set_id = $1', [fixture.tableSetId]);
    await run('DELETE FROM table_set WHERE id = $1', [fixture.tableSetId]);
  }
  await run('DELETE FROM app_user WHERE email = ANY($1::TEXT[])', [fixture.emails]);
  fixture = undefined;
}

async function login(page, user, expectedPath = '/slots') {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByRole('textbox', { name: 'Password' }).fill(user.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(new RegExp(`${escapeRegex(expectedPath)}(?:[/?#]|$)`));
}

async function openSlots(page) {
  await login(page, fixture.staff);
  await expect(page.getByRole('heading', { level: 1, name: 'Slots & tables' })).toBeVisible();
}

async function selectSource(page) {
  const day = page.locator('[role="radiogroup"]').first().getByRole('radio', {
    name: dayRadioPattern(fixture.sourceStart),
  });
  await expect(day).toBeVisible();
  await day.click();
  await expect(page.locator('#day-title')).toContainText(dayLabel(fixture.sourceStart));
}

async function openCopyDialog(page) {
  await page.getByRole('button', { name: 'Copy this week', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Period to copy', { exact: true })).toBeVisible();
  return dialog;
}

const destinationPeriod = (dialog, from) => dialog.locator('label').filter({ hasText: periodPattern(from) });

async function tickPeriod(dialog, from) {
  const row = destinationPeriod(dialog, from);
  await expect(row.getByRole('checkbox')).toBeEnabled();
  await row.getByRole('checkbox').check();
  return row;
}

async function submitCopy(dialog, selectedCount, replace = false) {
  const label = `Copy to ${selectedCount} period${selectedCount === 1 ? '' : 's'}`;
  await dialog.getByRole('button', { name: label, exact: true }).click();
  if (replace) {
    await expect(dialog.getByRole('button', { name: 'Go back', exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Replace and copy', exact: true }).click();
  }
}

async function expectCopied(page, dialog) {
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status')).toContainText(/Copied .* continuation period/);
}

async function copiedScheduleCount(periodStart) {
  return count(
    `SELECT COUNT(*) FROM slot
     WHERE service_date BETWEEN $1::DATE AND ($1::DATE + 6)
       AND starts_at = ANY($2::TIME[])`,
    [periodStart, fixture.sourceTimes],
  );
}

const dayOffset = (from, to) => Math.round(
  (new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86400000,
);

// Keep the assertions about the schedule independent of slot ids: copying creates new rows but
// must preserve the complete slot definition and its relative day.
const scheduleSnapshot = async (periodStart) => {
  const rows = await all(
    `SELECT service_date::TEXT AS date, starts_at::TEXT AS "startsAt", ends_at::TEXT AS "endsAt",
            table_set_id AS "tableSetId",
            COALESCE((SELECT SUM(seat_capacity) FROM hut_table WHERE table_set_id = slot.table_set_id), 0)::INTEGER AS "totalSeats"
     FROM slot
     WHERE service_date BETWEEN $1::DATE AND ($1::DATE + 6)
     ORDER BY service_date, starts_at`,
    [periodStart],
  );
  return rows.map((slot) => ({ ...slot, offset: dayOffset(periodStart, slot.date) }));
};

const bookingCountInPeriod = (periodStart) => count(
  `SELECT COUNT(*)
   FROM booking
   JOIN slot ON slot.id = booking.slot_id
   WHERE slot.service_date BETWEEN $1::DATE AND ($1::DATE + 6)`,
  [periodStart],
);

const expectApiErrorCode = async (response, code) => {
  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toMatchObject({ code });
};

test.describe('MH-09 Repeat a weekly schedule', () => {
  test.beforeEach(async () => {
    sequence += 1;
    fixture = {
      number: sequence,
      prefix: `E2E-MH9-${RUN_ID}-${sequence}`,
      sourceStart: await nextFreeSource(),
      days: [],
      times: [],
      emails: [],
      tableSetId: null,
    };
    fixture.days = Array.from({ length: 35 }, (_, index) => addDays(fixture.sourceStart, index));
    fixture.staff = await createUser({ role: 'EMPLOYEE', label: 'Employee' });
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test.afterAll(async () => {
    await close();
  });

  test('copies a selected non-Monday period into an empty period', async ({ page }) => {
    await createSourceSchedule();
    const sourceBefore = await scheduleSnapshot(fixture.sourceStart);
    expect(new Date(`${fixture.sourceStart}T12:00:00`).getDay()).not.toBe(1);
    const destination = addDays(fixture.sourceStart, 7);
    await openSlots(page);
    await selectSource(page);
    const dialog = await openCopyDialog(page);
    await tickPeriod(dialog, destination);
    await submitCopy(dialog, 1);
    await expectCopied(page, dialog);
    expect(await scheduleSnapshot(destination)).toEqual(sourceBefore);
    expect(await bookingCountInPeriod(destination)).toBe(0);
    expect(await scheduleSnapshot(fixture.sourceStart)).toEqual(sourceBefore);
  });

  test('replaces an existing destination after confirmation', async ({ page }) => {
    await createSourceSchedule();
    const sourceBefore = await scheduleSnapshot(fixture.sourceStart);
    const destination = addDays(fixture.sourceStart, 7);
    const oldSlot = await createSlot(destination, '10:00', '11:00');
    await openSlots(page);
    await selectSource(page);
    const dialog = await openCopyDialog(page);
    await tickPeriod(dialog, destination);
    await submitCopy(dialog, 1, true);
    await expectCopied(page, dialog);
    expect(await scheduleSnapshot(destination)).toEqual(sourceBefore);
    expect(await bookingCountInPeriod(destination)).toBe(0);
    expect(await scheduleSnapshot(fixture.sourceStart)).toEqual(sourceBefore);
    expect(await count('SELECT COUNT(*) FROM slot WHERE id = $1', [oldSlot.slotId])).toBe(0);
  });

  test('copies to contiguous and non-consecutive periods selected one by one', async ({ page }) => {
    await createSourceSchedule();
    const sourceBefore = await scheduleSnapshot(fixture.sourceStart);
    const destinations = [7, 14, 28].map((offset) => addDays(fixture.sourceStart, offset));
    await openSlots(page);
    await selectSource(page);
    const dialog = await openCopyDialog(page);
    for (const destination of destinations) await tickPeriod(dialog, destination);
    await submitCopy(dialog, 3);
    await expectCopied(page, dialog);
    for (const destination of destinations) {
      expect(await scheduleSnapshot(destination)).toEqual(sourceBefore);
      expect(await bookingCountInPeriod(destination)).toBe(0);
    }
    expect(await scheduleSnapshot(fixture.sourceStart)).toEqual(sourceBefore);
  });

  test('does not allow a period with an active booking to be ticked', async ({ page }) => {
    await createSourceSchedule();
    const destination = await createSlot(addDays(fixture.sourceStart, 7), '10:00', '11:00');
    await createBooking(destination);
    await openSlots(page);
    await selectSource(page);
    const dialog = await openCopyDialog(page);
    const row = destinationPeriod(dialog, addDays(fixture.sourceStart, 7));
    await expect(row.getByRole('checkbox')).toBeDisabled();
    await expect(row).toContainText('cannot be replaced');
  });

  test('disables copying when the source period is empty', async ({ page }) => {
    await openSlots(page);
    await selectSource(page);
    const dialog = await openCopyDialog(page);
    await expect(dialog.getByRole('region', { name: 'Source period' }).getByText('0 slots', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Copy to 0 periods', exact: true })).toBeDisabled();
    const response = await page.request.post('/api/staff/slots/copy-week', {
      data: {
        sourceStart: fixture.sourceStart,
        destinationIntervals: [{ from: addDays(fixture.sourceStart, 7), to: addDays(fixture.sourceStart, 13) }],
      },
    });
    await expectApiErrorCode(response, 'EMPTY_SOURCE_WEEK');
  });

  test('replaces a destination with only cancelled bookings and deletes them', async ({ page }) => {
    await createSourceSchedule();
    const destination = await createSlot(addDays(fixture.sourceStart, 7), '10:00', '11:00');
    const bookingId = await createBooking(destination, true);
    await openSlots(page);
    await selectSource(page);
    const dialog = await openCopyDialog(page);
    await tickPeriod(dialog, addDays(fixture.sourceStart, 7));
    await submitCopy(dialog, 1, true);
    await expectCopied(page, dialog);
    expect(await copiedScheduleCount(addDays(fixture.sourceStart, 7))).toBe(3);
    expect(await count('SELECT COUNT(*) FROM booking WHERE id = $1', [bookingId])).toBe(0);
    expect(await count('SELECT COUNT(*) FROM booking_table WHERE booking_id = $1', [bookingId])).toBe(0);
  });

  test('refreshes and keeps the copy atomic when a booking arrives while open', async ({ page }) => {
    await createSourceSchedule();
    const destinationStart = addDays(fixture.sourceStart, 7);
    const retainedStart = addDays(fixture.sourceStart, 14);
    const destination = await createSlot(destinationStart, '10:00', '11:00');
    await openSlots(page);
    await selectSource(page);
    const dialog = await openCopyDialog(page);
    await tickPeriod(dialog, destinationStart);
    await tickPeriod(dialog, retainedStart);
    await submitCopy(dialog, 2, false);
    const hikerBooking = await createBooking(destination);
    await dialog.getByRole('button', { name: 'Replace and copy', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('Nothing was copied');
    const row = destinationPeriod(dialog, destinationStart);
    await expect(row.getByRole('checkbox')).toBeDisabled();
    await expect(destinationPeriod(dialog, retainedStart).getByRole('checkbox')).toBeChecked();
    expect(await copiedScheduleCount(destinationStart)).toBe(0);
    expect(await copiedScheduleCount(retainedStart)).toBe(0);
    expect(await count('SELECT COUNT(*) FROM booking WHERE id = $1', [hikerBooking])).toBe(1);
  });

  test('rejects invalid destination intervals through the API', async ({ page }) => {
    await createSourceSchedule();
    await openSlots(page);
    const invalid = await page.request.post('/api/staff/slots/copy-week', {
      data: {
        sourceStart: fixture.sourceStart,
        destinationIntervals: [{ from: addDays(fixture.sourceStart, 1), to: addDays(fixture.sourceStart, 7) }],
      },
    });
    await expectApiErrorCode(invalid, 'INVALID_DESTINATION_INTERVAL');
    const samePeriod = await page.request.post('/api/staff/slots/copy-week', {
      data: {
        sourceStart: fixture.sourceStart,
        destinationIntervals: [{ from: fixture.sourceStart, to: addDays(fixture.sourceStart, 6) }],
      },
    });
    await expectApiErrorCode(samePeriod, 'INVALID_DESTINATION_INTERVAL');
    const overlap = await page.request.post('/api/staff/slots/copy-week', {
      data: {
        sourceStart: fixture.sourceStart,
        destinationIntervals: [
          { from: addDays(fixture.sourceStart, 7), to: addDays(fixture.sourceStart, 20) },
          { from: addDays(fixture.sourceStart, 14), to: addDays(fixture.sourceStart, 20) },
        ],
      },
    });
    await expectApiErrorCode(overlap, 'OVERLAPPING_WEEKS');
  });

  test('keeps the copy flow staff-only', async ({ page }) => {
    const hiker = await createUser({ role: 'HIKER', label: 'Hiker' });
    await login(page, hiker, '/book');
    await page.goto('/slots');
    await expect(page.getByRole('heading', { level: 1, name: 'Staff only' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy this week', exact: true })).toHaveCount(0);
    await page.context().clearCookies();
    await page.goto('/slots');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: 'Copy this week', exact: true })).toHaveCount(0);
  });
});
