// E2E TESTS of story MH-02 (define tables and slots): the staff page "Slots & tables" in a real browser,
// with the real client, server and database. The scenarios are in docs/MH-2-define-tables-and-slots-e2e-scenarios.md
// and the screens in docs/mockups/slots; the names of the controls are the ones of the page.
//
// Each test makes its own data (a staff account, table sets named "E2E-<id> ..." and one future day)
// and removes it afterwards, so the tests do not depend on each other or on the demo data.
import { expect, test } from '@playwright/test';

if (process.env.E2E_DATABASE_URL) process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
const { close, get, run } = await import('../../server/src/dao/db.js');
const slots = await import('../../server/src/dao/slots.js');
const tableSets = await import('../../server/src/dao/tableSets.js');
const users = await import('../../server/src/dao/users.js');
const { hash } = await import('../../server/src/passwordHasher.js');

const password = 'quota-e2e-2026';
const runId = Date.now().toString(36);
let fixture;
let testCount = 0;
let nextDayOffset = 3;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The day 'YYYY-MM-DD', `offset` days from today, as the page sees it (the time of the computer).
const dayFromToday = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

// 'Thu 5 Nov', the heading of the chosen day.
const dayLabel = (day) => {
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  const date = new Date(year, month - 1, dayOfMonth);
  return `${WEEKDAYS[date.getDay()]} ${dayOfMonth} ${MONTHS[month - 1]}`;
};

// ---- the data of a test -------------------------------------------------------------------------

// A day of its own, within the two weeks of the day strip.
const newDay = () => {
  const day = dayFromToday(nextDayOffset);
  nextDayOffset = nextDayOffset >= 12 ? 3 : nextDayOffset + 1;
  fixture.days.push(day);
  return day;
};

const setName = (label) => `${fixture.prefix} ${label}`;

async function createStaff(role = 'EMPLOYEE') {
  const email = `e2e-staff-${runId}-${fixture.emails.length}@example.com`;
  await users.insert({
    firstName: 'Anna',
    lastName: 'Ferri',
    email,
    phone: null,
    role,
    passwordHash: await hash(password),
  });
  fixture.emails.push(email);
  return { email, password };
}

async function createHiker(request) {
  const email = `e2e-hiker-${runId}-${fixture.emails.length}@example.com`;
  const response = await request.post('/api/auth/register', {
    data: { firstName: 'E2E', lastName: 'Hiker', email, phone: '', password },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  fixture.emails.push(email);
  return { email, password };
}

// A table set made directly in the database, with the tables numbered from 1.
const createSetInDb = (label, capacities) =>
  tableSets.insert({
    name: setName(label),
    tables: capacities.map((capacity, index) => ({ tableNumber: index + 1, capacity })),
  });

const createSlotInDb = (date, startsAt, endsAt, tableSetId = null) =>
  slots.insert({ serviceDate: date, startsAt, endsAt, tableSetId });

const countIn = async (sql, params) => (await get(sql, params)).n;
const countOurSets = () =>
  countIn('SELECT COUNT(*)::INT AS n FROM table_set WHERE name LIKE $1', [`${fixture.prefix}%`]);
const countSlotsOf = (day) => countIn('SELECT COUNT(*)::INT AS n FROM slot WHERE service_date = $1', [day]);

async function cleanup() {
  if (!fixture) return;
  for (const day of fixture.days) {
    await run('DELETE FROM slot WHERE service_date = $1', [day]);
  }
  const ours = 'SELECT id FROM table_set WHERE name LIKE $1';
  await run(`DELETE FROM slot WHERE table_set_id IN (${ours})`, [`${fixture.prefix}%`]);
  await run(`DELETE FROM hut_table WHERE table_set_id IN (${ours})`, [`${fixture.prefix}%`]);
  await run('DELETE FROM table_set WHERE name LIKE $1', [`${fixture.prefix}%`]);
  if (fixture.emails.length > 0) {
    await run('DELETE FROM app_user WHERE email = ANY($1::text[])', [fixture.emails]);
  }
  fixture = undefined;
}

// ---- the page ------------------------------------------------------------------------------------

async function login(page, user) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByRole('textbox', { name: 'Password' }).fill(user.password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

// Logs in as a member of the staff and waits for Slots & tables, where the staff starts.
async function openSlotsPage(page, role = 'EMPLOYEE') {
  const staff = await createStaff(role);
  await login(page, staff);
  await expect(page).toHaveURL(/\/slots/);
  await expect(page.getByRole('heading', { level: 1, name: 'Slots & tables' })).toBeVisible();
  return staff;
}

const tableSetsCard = (page) => page.getByRole('complementary', { name: 'Table sets' });
const slotRow = (page, startsAt, endsAt) => page.getByRole('listitem').filter({ hasText: `${startsAt} – ${endsAt}` });
const dayHeading = (page) => page.getByRole('heading', { level: 2, name: /^[A-Z][a-z]{2} \d+ [A-Z][a-z]{2}/ });

// The table sets of the dialogs are radio cards: the text of the card is its name.
const pickTableSet = async (dialog, label) => {
  const card = dialog.locator('label').filter({ hasText: setName(label) });
  await card.click();
  await expect(dialog.getByRole('radio', { name: new RegExp(escapeRegExp(setName(label))) })).toBeChecked();
};

// New table set: the name, then each table by its seats (and its number, when it is not the next one).
async function fillTableSet(dialog, name, tables) {
  await dialog.getByLabel('Name').fill(name);
  for (const { tableNumber, capacity } of tables) {
    if (tableNumber !== undefined) await dialog.getByLabel('Number of the new table').fill(String(tableNumber));
    const seats = dialog.getByPlaceholder('seats');
    await seats.fill(String(capacity));
    await seats.press('Enter');
  }
}

async function createTableSetInPage(page, name, tables) {
  await tableSetsCard(page).getByRole('button', { name: '+ New table set' }).click();
  const dialog = page.getByRole('dialog', { name: 'New table set' });
  await fillTableSet(dialog, name, tables);
  await dialog.getByRole('button', { name: 'Save table set' }).click();
  await expect(dialog).toBeHidden();
}

async function addSlotInPage(page, { day, startsAt, endsAt, tables }) {
  await page.getByRole('button', { name: '+ Add a slot' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add a slot' });
  await dialog.getByLabel('Day').fill(day);
  await dialog.getByLabel('Starts at').fill(startsAt);
  await dialog.getByLabel('Ends at').fill(endsAt);
  if (tables === null) {
    await dialog.locator('label').filter({ hasText: 'No tables for now' }).click();
  } else {
    await pickTableSet(dialog, tables);
  }
  await dialog.getByRole('button', { name: 'Add slot' }).click();
  return dialog;
}

test.describe('MH-2 Define tables and slots', () => {
  test.beforeEach(() => {
    testCount += 1;
    fixture = { prefix: `E2E-${runId}-${testCount}`, days: [], emails: [] };
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test.afterAll(async () => {
    await close();
  });

  test('an employee creates a table set', async ({ page }) => {
    const name = setName('Lunch, main room');
    await openSlotsPage(page);

    await tableSetsCard(page).getByRole('button', { name: '+ New table set' }).click();
    const dialog = page.getByRole('dialog', { name: 'New table set' });
    await fillTableSet(dialog, name, [{ capacity: 4 }, { capacity: 4 }, { capacity: 6 }]);
    await expect(dialog.getByText('3 tables · 14 seats')).toBeVisible();
    await dialog.getByRole('button', { name: 'Save table set' }).click();

    await expect(dialog).toBeHidden();
    const item = tableSetsCard(page).getByRole('listitem').filter({ hasText: name });
    await expect(item).toContainText('3 tables · 14 seats');
    expect(await countIn(
      'SELECT COUNT(*)::INT AS n FROM hut_table WHERE table_set_id = (SELECT id FROM table_set WHERE name = $1)',
      [name],
    )).toBe(3);

    await page.reload();
    await expect(tableSetsCard(page).getByRole('listitem').filter({ hasText: name })).toContainText('3 tables · 14 seats');
  });

  test('an employee makes a table set from another one, and the first one does not change', async ({ page }) => {
    const first = setName('Lunch, main room');
    const second = setName('Lunch, rainy day');
    await createSetInDb('Lunch, main room', [4, 4, 6]);
    await openSlotsPage(page);

    await tableSetsCard(page).getByRole('button', { name: '+ New table set' }).click();
    const dialog = page.getByRole('dialog', { name: 'New table set' });
    await dialog.getByLabel('Name').fill(second);
    await dialog.getByLabel('Copy the tables of').selectOption({ label: first });
    await expect(dialog.getByText('3 tables · 14 seats')).toBeVisible();
    await dialog.getByRole('button', { name: 'Remove table 3' }).click();
    await expect(dialog.getByText('2 tables · 8 seats')).toBeVisible();
    await dialog.getByRole('button', { name: 'Save table set' }).click();

    await expect(dialog).toBeHidden();
    await expect(tableSetsCard(page).getByRole('listitem').filter({ hasText: second })).toContainText('2 tables · 8 seats');
    await expect(tableSetsCard(page).getByRole('listitem').filter({ hasText: first })).toContainText('3 tables · 14 seats');
  });

  test('an employee creates a slot with a table set', async ({ page }) => {
    const day = newDay();
    await createSetInDb('Lunch, main room', [4, 4, 6]);
    await openSlotsPage(page);

    const dialog = await addSlotInPage(page, { day, startsAt: '12:00', endsAt: '13:30', tables: 'Lunch, main room' });

    await expect(dialog).toBeHidden();
    await expect(dayHeading(page)).toContainText(dayLabel(day));
    await expect(dayHeading(page)).toContainText('1 slot · 14 seats');
    const row = slotRow(page, '12:00', '13:30');
    await expect(row).toContainText('1 h 30');
    await expect(row).toContainText(setName('Lunch, main room'));
    await expect(row).toContainText('14');
    expect(await countIn(
      'SELECT COUNT(*)::INT AS n FROM slot WHERE service_date = $1 AND table_set_id IS NOT NULL',
      [day],
    )).toBe(1);
  });

  test('an employee creates more than one slot on a day, with the same table set', async ({ page }) => {
    const day = newDay();
    await createSetInDb('Lunch, main room', [4, 4, 6]);
    await openSlotsPage(page);

    await addSlotInPage(page, { day, startsAt: '12:00', endsAt: '13:00', tables: 'Lunch, main room' });
    await expect(slotRow(page, '12:00', '13:00')).toBeVisible();
    await addSlotInPage(page, { day, startsAt: '13:00', endsAt: '14:00', tables: 'Lunch, main room' });

    await expect(slotRow(page, '13:00', '14:00')).toBeVisible();
    await expect(dayHeading(page)).toContainText('2 slots · 28 seats');
    const rows = page.getByRole('listitem').filter({ hasText: / – / }).filter({ hasText: setName('Lunch, main room') });
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('12:00 – 13:00');
    await expect(rows.nth(1)).toContainText('13:00 – 14:00');
    expect(await countSlotsOf(day)).toBe(2);
  });

  test('different slots can have different table sets', async ({ page }) => {
    const day = newDay();
    await createSetInDb('Lunch, main room', [4, 4, 6]);
    await createSetInDb('Dinner, terrace', [4, 4, 6, 6]);
    await openSlotsPage(page);

    await addSlotInPage(page, { day, startsAt: '12:00', endsAt: '13:00', tables: 'Lunch, main room' });
    await expect(slotRow(page, '12:00', '13:00')).toBeVisible();
    await addSlotInPage(page, { day, startsAt: '19:00', endsAt: '21:00', tables: 'Dinner, terrace' });

    await expect(slotRow(page, '19:00', '21:00')).toBeVisible();
    await expect(slotRow(page, '12:00', '13:00')).toContainText(setName('Lunch, main room'));
    await expect(slotRow(page, '12:00', '13:00')).toContainText('14');
    await expect(slotRow(page, '19:00', '21:00')).toContainText(setName('Dinner, terrace'));
    await expect(slotRow(page, '19:00', '21:00')).toContainText('20');
    await expect(dayHeading(page)).toContainText('2 slots · 34 seats');
  });

  test('a slot without a table set has no seats until the employee gives it its tables', async ({ page }) => {
    const day = newDay();
    await createSetInDb('Dinner, terrace', [4, 4, 6, 6]);
    await openSlotsPage(page);

    await addSlotInPage(page, { day, startsAt: '19:00', endsAt: '21:00', tables: null });

    const row = slotRow(page, '19:00', '21:00');
    await expect(row).toContainText('No tables yet');
    await expect(row).toContainText('0 seats: hikers cannot book this time.');
    await expect(dayHeading(page)).toContainText('1 slot · 0 seats');

    await row.getByRole('button', { name: 'Choose tables' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tables for 19:00 – 21:00' });
    await pickTableSet(dialog, 'Dinner, terrace');
    await dialog.getByRole('button', { name: 'Give tables' }).click();

    await expect(dialog).toBeHidden();
    await expect(row).toContainText(setName('Dinner, terrace'));
    await expect(row).not.toContainText('No tables yet');
    await expect(row.getByRole('button', { name: 'Choose tables' })).toHaveCount(0);
    await expect(dayHeading(page)).toContainText('1 slot · 20 seats');
    expect(await countIn(
      'SELECT COUNT(*)::INT AS n FROM slot WHERE service_date = $1 AND table_set_id IS NOT NULL',
      [day],
    )).toBe(1);
  });

  test.describe('invalid data is rejected', () => {
    test('a table set needs a name and at least one table', async ({ page }) => {
      await openSlotsPage(page);

      await tableSetsCard(page).getByRole('button', { name: '+ New table set' }).click();
      const dialog = page.getByRole('dialog', { name: 'New table set' });
      await dialog.getByRole('button', { name: 'Save table set' }).click();

      await expect(dialog.getByText('Enter a name for the set.')).toBeVisible();
      await expect(dialog.getByText('Add at least one table.')).toBeVisible();
      await expect(dialog).toBeVisible();
      expect(await countOurSets()).toBe(0);
    });

    test('a table number cannot be used twice, and a table needs at least one seat', async ({ page }) => {
      await openSlotsPage(page);

      await tableSetsCard(page).getByRole('button', { name: '+ New table set' }).click();
      const dialog = page.getByRole('dialog', { name: 'New table set' });
      await fillTableSet(dialog, setName('Wrong tables'), [
        { tableNumber: 1, capacity: 4 },
        { tableNumber: 1, capacity: 2 },
        { tableNumber: 2, capacity: 0 },
      ]);
      await dialog.getByRole('button', { name: 'Save table set' }).click();

      await expect(dialog.getByText('Already used by another table.')).toBeVisible();
      await expect(dialog.getByText('At least 1 seat.')).toBeVisible();
      await expect(dialog).toBeVisible();
      expect(await countOurSets()).toBe(0);
    });

    test('a table set cannot have the name of another one, and the other one does not change', async ({ page }) => {
      await createSetInDb('Lunch, main room', [4, 4, 6]);
      await openSlotsPage(page);

      await tableSetsCard(page).getByRole('button', { name: '+ New table set' }).click();
      const dialog = page.getByRole('dialog', { name: 'New table set' });
      await fillTableSet(dialog, setName('Lunch, main room'), [{ capacity: 8 }]);
      await dialog.getByRole('button', { name: 'Save table set' }).click();

      await expect(dialog.getByText('A table set with this name already exists. Choose another name.')).toBeVisible();
      await expect(dialog).toBeVisible();
      expect(await countOurSets()).toBe(1);
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(tableSetsCard(page).getByRole('listitem').filter({ hasText: setName('Lunch, main room') }))
        .toContainText('3 tables · 14 seats');
    });

    test('a slot needs a start and an end, and it must end after it starts', async ({ page }) => {
      const day = newDay();
      await openSlotsPage(page);

      await page.getByRole('button', { name: '+ Add a slot' }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Add a slot' });
      await dialog.getByLabel('Day').fill(day);
      await dialog.getByRole('button', { name: 'Add slot' }).click();
      await expect(dialog.getByText('Enter the start time.')).toBeVisible();
      await expect(dialog.getByText('Enter the end time.')).toBeVisible();

      await dialog.getByLabel('Starts at').fill('13:00');
      await dialog.getByLabel('Ends at').fill('12:00');
      await dialog.getByRole('button', { name: 'Add slot' }).click();

      await expect(dialog.getByText('The slot must end after it starts.')).toBeVisible();
      await expect(dialog).toBeVisible();
      expect(await countSlotsOf(day)).toBe(0);
    });

    test('a slot cannot start at the same time as another one of the day', async ({ page }) => {
      const day = newDay();
      await createSlotInDb(day, '12:00', '13:00');
      await openSlotsPage(page);

      const dialog = await addSlotInPage(page, { day, startsAt: '12:00', endsAt: '14:00', tables: null });

      await expect(dialog.getByText(`A slot starting at 12:00 already exists on ${dayLabel(day)}.`)).toBeVisible();
      await expect(dialog.getByText('Already used.')).toBeVisible();
      await expect(dialog).toBeVisible();
      expect(await countSlotsOf(day)).toBe(1);
    });
  });

  test.describe('only the staff defines tables and slots', () => {
    test('a visitor is sent to the login and, after it, back to Slots & tables', async ({ page }) => {
      const staff = await createStaff();

      await page.goto('/slots');

      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByText('Log in to see the slots and tables.')).toBeVisible();
      await page.getByLabel('Email').fill(staff.email);
      await page.getByRole('textbox', { name: 'Password' }).fill(staff.password);
      await page.getByRole('button', { name: 'Log in' }).click();
      await expect(page).toHaveURL(/\/slots/);
      await expect(page.getByRole('heading', { level: 1, name: 'Slots & tables' })).toBeVisible();
    });

    test('a hiker who opens the page is told that it is for the staff', async ({ page, request }) => {
      const hiker = await createHiker(request);
      await login(page, hiker);
      await expect(page).toHaveURL(/\/book/);

      await page.goto('/slots');

      await expect(page.getByRole('heading', { level: 1, name: 'Staff only' })).toBeVisible();
      await expect(page.getByText('This page is for the hut team.')).toBeVisible();
      await expect(page.getByRole('button', { name: '+ Add a slot' })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Slots & tables' })).toHaveCount(0);
    });

    test('the warden can define slots like an employee', async ({ page }) => {
      const day = newDay();
      await createSetInDb('Lunch, main room', [4, 4, 6]);
      await openSlotsPage(page, 'WARDEN');

      await addSlotInPage(page, { day, startsAt: '12:00', endsAt: '13:00', tables: 'Lunch, main room' });

      await expect(slotRow(page, '12:00', '13:00')).toContainText('14');
      expect(await countSlotsOf(day)).toBe(1);
    });
  });

  test('what the staff defines is what a hiker finds on Book a table (MH-1)', async ({ page, browser, request }, testInfo) => {
    const day = newDay();
    await createSetInDb('Lunch, main room', [2, 4]);
    await openSlotsPage(page);
    await addSlotInPage(page, { day, startsAt: '12:00', endsAt: '13:00', tables: 'Lunch, main room' });
    await expect(slotRow(page, '12:00', '13:00')).toBeVisible();
    await addSlotInPage(page, { day, startsAt: '19:00', endsAt: '21:00', tables: null });
    await expect(slotRow(page, '19:00', '21:00')).toBeVisible();

    // The hiker has a browser of their own: the staff stays logged in in `page`.
    const hikerContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
    const hikerPage = await hikerContext.newPage();
    const hiker = await createHiker(request);
    await login(hikerPage, hiker);
    await expect(hikerPage).toHaveURL(/\/book/);
    await hikerPage.locator('button[role="radio"]').filter({
      hasText: new RegExp(`(?:^|\\D)${Number(day.slice(-2))}(?:\\D|$)`),
    }).first().click();

    const withTables = hikerPage.getByRole('radio', { name: /12:00/ });
    await expect(withTables).toBeEnabled();
    await expect(withTables).toContainText('6 seats free');
    await expect(hikerPage.getByRole('radio', { name: /19:00/ })).toBeDisabled();
    await hikerContext.close();
  });
});
