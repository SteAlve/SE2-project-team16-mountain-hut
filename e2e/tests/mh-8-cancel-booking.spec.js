// MH-08 — Cancel a booking.
// Source: docs/e2e-definitions/MH-8-cancel-booking-e2e-scenarios.md (commit 60eb5c0).
// Browser E2E against the real frontend, API, PostgreSQL and Mailpit. Controlled HTTP failures
// are labelled UI-contract tests; they do not prove real backend failure or transaction rollback.
import { randomUUID } from 'node:crypto';
import { expect, test as base } from '@playwright/test';

if (process.env.E2E_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
  process.env.TEST_DATABASE_URL = process.env.E2E_DATABASE_URL;
}
const { config } = await import('../../server/src/config.js');
const { all, close, get, inTransaction, run } = await import('../../server/src/dao/db.js');
const bookings = await import('../../server/src/dao/bookings.js');
const { hash } = await import('../../server/src/passwordHasher.js');

const PASSWORD = 'quota-e2e-mh08';
const MAILPIT = process.env.MAILPIT_URL;
const ZONE = 'Europe/Rome';
const GENERIC = 'Something went wrong on our side. Try again in a minute.';
const REQ = { diets: ['VEGAN'], allergies: [], otherDiet: null, otherAllergy: null, otherRequests: null };
const reference = (id) => `QUOTA-${String(id).padStart(5, '0')}`;
const cancellationSubject = (id) => `Your booking has been cancelled (${reference(id)})`;
const parts = (date, options) => Object.fromEntries(
  new Intl.DateTimeFormat('en-GB', options).formatToParts(date).map(({ type, value }) => [type, value]),
);
const romeDay = (days = 0) => {
  const p = parts(new Date(Date.now() + days * 86400000), {
    timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return `${p.year}-${p.month}-${p.day}`;
};
const dayLabel = (date) => {
  const p = parts(new Date(`${date}T12:00:00Z`), {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short',
  });
  return `${p.weekday} ${p.day} ${p.month}`;
};
const longDay = (date) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date(`${date}T12:00:00Z`));
const localMoment = (value) => {
  const p = parts(new Date(value), {
    timeZone: ZONE, day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
};

async function allMail(api, email) {
  const response = await api.get(`${MAILPIT}/api/v1/search`, {
    params: { query: `to:"${email}"` },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).messages ?? [];
}
async function cancellationMail(api, email, bookingId) {
  return (await allMail(api, email)).filter(({ Subject }) => Subject === cancellationSubject(bookingId));
}
async function waitForCancellationMail(f, owner, booking, before = []) {
  let found = [];
  const seen = new Set(before.map(({ ID }) => ID));
  await expect.poll(async () => {
    found = (await cancellationMail(f.api, owner.email, booking.id)).filter(({ ID }) => !seen.has(ID));
    return found.length;
  }, { timeout: 10_000, message: 'One new MH-08 cancellation email in Mailpit' }).toBe(1);
  const detail = await f.api.get(`${MAILPIT}/api/v1/message/${found[0].ID}`);
  expect(detail.ok()).toBeTruthy();
  return detail.json();
}
async function noCancellationMail(f, owner, booking, before = []) {
  const seen = new Set(before.map(({ ID }) => ID));
  expect((await cancellationMail(f.api, owner.email, booking.id)).filter(({ ID }) => !seen.has(ID))).toEqual([]);
}

// Each scenario owns only its fixtures. No global database or mailbox wipe.
const test = base.extend({
  scenario: async ({ request, playwright }, use) => {
    const f = { api: request, playwright, emails: [], contexts: [], setIds: [], slotIds: [] };
    try {
      for (let offset = 4; offset < 60; offset += 1) {
        const candidate = [romeDay(offset), romeDay(offset + 1)];
        if (!(await get('SELECT 1 FROM slot WHERE service_date = ANY($1::DATE[])', [candidate]))) {
          f.dates = candidate;
          break;
        }
      }
      expect(f.dates, 'Two unused future hut days for MH-08').toHaveLength(2);
      await use(f);
    } finally {
      // booking_table and booking_requirement cascade from booking; sessions cascade from app_user.
      await inTransaction(async () => {
        if (f.slotIds.length) {
          await run('DELETE FROM booking WHERE slot_id = ANY($1::INTEGER[])', [f.slotIds]);
          await run('DELETE FROM slot WHERE id = ANY($1::INTEGER[])', [f.slotIds]);
        }
        if (f.setIds.length) {
          await run('DELETE FROM hut_table WHERE table_set_id = ANY($1::INTEGER[])', [f.setIds]);
          await run('DELETE FROM table_set WHERE id = ANY($1::INTEGER[])', [f.setIds]);
        }
        if (f.emails.length) await run('DELETE FROM app_user WHERE email = ANY($1::TEXT[])', [f.emails]);
      });
      // Filter by our unique addresses; Mailpit interprets an empty IDs array as delete-all.
      if (MAILPIT && f.emails.length) {
        const ids = (await Promise.all(f.emails.map((email) => allMail(f.api, email))))
          .flat().map(({ ID }) => ID);
        if (ids.length) {
          const response = await f.api.delete(`${MAILPIT}/api/v1/messages`, { data: { IDs: ids } });
          expect(response.ok(), await response.text()).toBeTruthy();
        }
      }
      await Promise.all(f.contexts.map((context) => context.dispose()));
    }
  },
});

test.beforeAll(async ({ request }) => {
  expect(process.env.E2E_DATABASE_URL, 'Set E2E_DATABASE_URL to a dedicated test database').toBeTruthy();
  expect(config.databaseUrl).toBe(process.env.E2E_DATABASE_URL);
  expect(new URL(config.databaseUrl).pathname, 'Never run MH-08 against the development DB')
    .not.toBe('/mountain_hut');
  expect(MAILPIT, 'MAILPIT_URL and Mailpit SMTP are required by MH-08 email assertions').toBeTruthy();
  const info = await request.get(`${MAILPIT}/api/v1/info`);
  expect(info.ok(), 'Mailpit API must be reachable').toBeTruthy();
});
test.afterAll(async () => { await close(); });

async function isolatedApi(f) {
  const api = await f.playwright.request.newContext({ baseURL: 'http://localhost:5173' });
  f.contexts.push(api);
  return api;
}
async function hiker(f, api) {
  const email = `e2e-mh08-${randomUUID()}@example.com`;
  f.emails.push(email);
  const profile = { firstName: 'Mara', lastName: 'Rossi', email, password: PASSWORD };
  const response = await api.post('/api/auth/register', { data: profile });
  expect(response.status(), await response.text()).toBe(201);
  const row = await get('SELECT id FROM app_user WHERE email = $1', [email]);
  return { ...profile, id: row.id, api };
}
async function staff(f, role) {
  const api = await isolatedApi(f);
  const email = `e2e-mh08-${role.toLowerCase()}-${randomUUID()}@example.com`;
  f.emails.push(email);
  await get(`INSERT INTO app_user (first_name, last_name, email, role, password_hash)
    VALUES ('E2E', 'Staff', $1, $2, $3) RETURNING id`, [email, role, await hash(PASSWORD)]);
  const response = await api.post('/api/auth/login', { data: { email, password: PASSWORD } });
  expect(response.status(), await response.text()).toBe(200);
  return { api, email, role };
}
async function slot(f, { date = f.dates[0], startsAt = '12:00', endsAt = '13:00', capacities = [8] } = {}) {
  return inTransaction(async () => {
    const set = await get('INSERT INTO table_set (name) VALUES ($1) RETURNING id', [`E2E MH-08 ${randomUUID()}`]);
    f.setIds.push(set.id);
    const tables = [];
    for (const [index, capacity] of capacities.entries()) {
      tables.push(await get(`INSERT INTO hut_table (table_set_id, table_number, seat_capacity)
        VALUES ($1, $2, $3) RETURNING id, table_number AS "tableNumber", seat_capacity AS capacity`,
      [set.id, index + 1, capacity]));
    }
    const item = await get(`INSERT INTO slot (service_date, starts_at, ends_at, table_set_id)
      VALUES ($1, $2, $3, $4) RETURNING id`, [date, startsAt, endsAt, set.id]);
    f.slotIds.push(item.id);
    return { slotId: item.id, date, startsAt, endsAt, tables };
  });
}
async function nearSlot(f, date = romeDay(1)) {
  for (let hour = 8; hour <= 20; hour += 1) {
    const startsAt = `${String(hour).padStart(2, '0')}:00`;
    const endsAt = `${String(hour + 1).padStart(2, '0')}:00`;
    // Avoid an interval conflict, not just another slot with the same start time.
    if (!(await get(`SELECT 1 FROM slot WHERE service_date = $1
      AND starts_at < $3::TIME AND ends_at > $2::TIME`, [date, startsAt, endsAt]))) {
      return slot(f, { date, startsAt, endsAt });
    }
  }
  throw new Error(`No unused slot on ${date} for MH-08 near/past fixture`);
}
async function book(owner, meal, { partySize = 3, requirements = [REQ], seats = partySize } = {}) {
  const created = await bookings.createWithTableAssignments({
    hikerId: owner.id, slotId: meal.slotId, partySize, requirements,
    tableAssignments: [{ tableId: meal.tables[0].id, seatCount: seats }],
  });
  return bookings.findById(created.id);
}
async function snapshot(id) {
  return {
    booking: await get('SELECT * FROM booking WHERE id = $1', [id]),
    tables: await all('SELECT * FROM booking_table WHERE booking_id = $1 ORDER BY hut_table_id', [id]),
    needs: await all('SELECT * FROM booking_requirement WHERE booking_id = $1 ORDER BY id', [id]),
  };
}
const seatsFree = async (meal) => (await get(`
  SELECT ht.seat_capacity - COALESCE(SUM(bt.seat_count) FILTER (WHERE b.cancelled_at IS NULL), 0)::INTEGER AS free
  FROM hut_table ht
  LEFT JOIN booking_table bt ON bt.hut_table_id = ht.id AND bt.slot_id = $1
  LEFT JOIN booking b ON b.id = bt.booking_id
  WHERE ht.id = $2
  GROUP BY ht.id, ht.seat_capacity
`, [meal.slotId, meal.tables[0].id])).free;
const card = (page, booking) => page.getByRole('listitem', { name: `Booking ${reference(booking.id)}`, exact: true });
const dialog = (page) => page.getByRole('dialog', { name: 'Cancel this booking?', exact: true });
const action = (page, booking) => card(page, booking).getByRole('button', {
  name: `Cancel booking ${reference(booking.id)}`, exact: true,
});
const confirm = (page) => dialog(page).getByRole('button', { name: 'Cancel booking', exact: true });
const keep = (page) => dialog(page).getByRole('button', { name: 'Keep booking', exact: true });
const responseFor = (page, id, method = 'DELETE') => page.waitForResponse((r) =>
  new URL(r.url()).pathname === `/api/bookings/${id}` && r.request().method() === method);
const bookingListResponse = (page) => page.waitForResponse((r) =>
  new URL(r.url()).pathname === '/api/bookings' && r.request().method() === 'GET');
function observeDeletes(page, id) {
  const seen = [];
  page.on('request', (r) => {
    if (r.method() === 'DELETE' && new URL(r.url()).pathname === `/api/bookings/${id}`) seen.push(r);
  });
  return seen;
}
async function openBookings(page) {
  const loaded = bookingListResponse(page);
  await page.goto('/bookings');
  expect((await loaded).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'My bookings' })).toBeVisible();
}
async function openDialog(page, booking) {
  await action(page, booking).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).toContainText(`Your table for ${booking.partySize} on ${dayLabel(booking.date)}, `);
  await expect(dialog(page)).toContainText(`${booking.startsAt.slice(0, 5)} – ${booking.endsAt.slice(0, 5)} will be cancelled.`);
}
async function cancelThroughBrowser(page, booking) {
  const deleted = responseFor(page, booking.id);
  const refreshed = bookingListResponse(page);
  const started = Date.now();
  await confirm(page).click();
  const response = await deleted;
  const finished = Date.now();
  expect(response.status(), await response.text()).toBe(204);
  expect(await response.text()).toBe('');
  expect((await refreshed).status()).toBe(200);
  await expect(dialog(page)).toHaveCount(0);
  await expect(card(page, booking)).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText(
    `Booking ${reference(booking.id)} cancelled. We emailed you a confirmation.`,
  );
  return { started, finished };
}
async function ownerList(owner) {
  const response = await owner.api.get('/api/bookings');
  expect(response.status()).toBe(200);
  return response.json();
}
async function unchanged(f, owner, booking, before) {
  expect(await snapshot(booking.id)).toEqual(before);
  expect((await ownerList(owner)).some((b) => b.id === booking.id)).toBe(true);
  await noCancellationMail(f, owner, booking);
}
async function cancelled(booking, before) {
  const after = await snapshot(booking.id);
  expect(after.booking.cancelled_at).not.toBeNull();
  expect({ ...after.booking, cancelled_at: null }).toEqual(before.booking);
  expect(after.tables).toEqual(before.tables);
  expect(after.needs).toEqual(before.needs);
  return after;
}
async function setup(f, page, overrides = {}) {
  const owner = await hiker(f, page.request);
  const meal = await slot(f, overrides);
  const booking = await book(owner, meal, overrides);
  return { owner, meal, booking, before: await snapshot(booking.id) };
}

// Scenario 1: the correct card is accessible, cancellation has no 48-hour deadline.
test('S1 — cancellation is available only on the owner’s active booking cards', async ({ page, scenario: f }) => {
  const t = await setup(f, page);
  const near = await nearSlot(f);
  const nearBooking = await book(t.owner, near);
  const extra = await slot(f, { date: f.dates[1] });
  const alreadyCancelled = await book(t.owner, extra);
  await run('UPDATE booking SET cancelled_at = now() WHERE id = $1', [alreadyCancelled.id]);
  const past = await nearSlot(f, romeDay(-3));
  const pastBooking = await book(t.owner, past);
  const other = await hiker(f, await isolatedApi(f));
  const otherBooking = await book(other, t.meal, { partySize: 2 });
  const observed = observeDeletes(page, nearBooking.id);
  await openBookings(page);
  await expect(card(page, t.booking)).toBeVisible();
  await expect(card(page, nearBooking)).toBeVisible();
  for (const booking of [alreadyCancelled, pastBooking, otherBooking]) {
    await expect(card(page, booking)).toHaveCount(0);
  }
  await expect(card(page, nearBooking).getByRole('button', { name: 'Edit' })).toBeDisabled();
  await expect(card(page, nearBooking)).toContainText('Changes closed on');
  await expect(action(page, nearBooking)).toBeEnabled();
  await expect(action(page, t.booking)).toBeEnabled();
  await expect(dialog(page)).toHaveCount(0);
  expect(observed).toHaveLength(0);
});

// Scenario 2: merely opening confirmation is non-destructive.
test('S2 — the confirmation shows the saved booking and sends no DELETE', async ({ page, scenario: f }) => {
  const t = await setup(f, page);
  const observed = observeDeletes(page, t.booking.id);
  await openBookings(page);
  await openDialog(page, t.booking);
  await expect(keep(page)).toBeEnabled();
  await expect(confirm(page)).toBeEnabled();
  expect(observed).toHaveLength(0);
  await unchanged(f, t.owner, t.booking, t.before);
});

// Scenario 3: independent tests for each real dismissal mechanism.
for (const method of ['Keep booking', 'Escape', 'backdrop']) {
  test(`S3 — ${method} dismisses the confirmation without cancelling`, async ({ page, scenario: f }) => {
    const t = await setup(f, page);
    const observed = observeDeletes(page, t.booking.id);
    const freeBefore = await seatsFree(t.meal);
    await openBookings(page);
    await openDialog(page, t.booking);
    if (method === 'Keep booking') await keep(page).click();
    else if (method === 'Escape') await page.keyboard.press('Escape');
    else await page.mouse.click(2, 2); // A genuine click on the native dialog's backdrop.
    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, t.booking)).toBeVisible();
    expect(observed).toHaveLength(0);
    await page.reload();
    await expect(card(page, t.booking)).toBeVisible();
    expect(await seatsFree(t.meal)).toBe(freeBefore);
    await unchanged(f, t.owner, t.booking, t.before);
  });
}

// Scenarios 4 and 12: the targeted card disappears while other bookings remain.
test('S4/S12 — successful 204 removes only the selected booking and retains history', async ({ page, scenario: f }) => {
  const t = await setup(f, page);
  const extra = await slot(f, { date: f.dates[1] });
  const survivor = await book(t.owner, extra, { partySize: 2 });
  const survivorBefore = await snapshot(survivor.id);
  const observed = observeDeletes(page, t.booking.id);
  const mailBefore = await cancellationMail(f.api, t.owner.email, t.booking.id);
  await openBookings(page);
  await openDialog(page, t.booking);
  const interval = await cancelThroughBrowser(page, t.booking);
  expect(observed).toHaveLength(1);
  expect(observed[0].postData()).toBeNull();
  await expect(card(page, survivor)).toBeVisible();
  const after = await cancelled(t.booking, t.before);
  const savedAt = new Date(after.booking.cancelled_at).getTime();
  expect(savedAt).toBeGreaterThanOrEqual(interval.started - 1000);
  expect(savedAt).toBeLessThanOrEqual(interval.finished + 1000);
  expect(await snapshot(survivor.id)).toEqual(survivorBefore);
  expect((await ownerList(t.owner)).map(({ id }) => id)).toEqual([survivor.id]);
  await waitForCancellationMail(f, t.owner, t.booking, mailBefore);
  await page.reload();
  await expect(card(page, t.booking)).toHaveCount(0);
  await expect(card(page, survivor)).toBeVisible();
});

// Scenario 5: release only the cancelled booking's seats and reuse them via the real public preview.
for (const rebooker of ['another hiker', 'original hiker']) {
  test(`S5 — freed seats can be reused by ${rebooker}`, async ({ page, scenario: f }) => {
    const t = await setup(f, page, { capacities: [8], partySize: 3 });
    const b = await hiker(f, await isolatedApi(f));
    const bBooking = await book(b, t.meal, { partySize: 2 });
    const bBefore = await snapshot(bBooking.id);
    expect(await seatsFree(t.meal)).toBe(3);
    await openBookings(page);
    await openDialog(page, t.booking);
    await cancelThroughBrowser(page, t.booking);
    await cancelled(t.booking, t.before);
    expect(await seatsFree(t.meal)).toBe(6);
    expect(await snapshot(bBooking.id)).toEqual(bBefore);

    const owner = rebooker === 'original hiker' ? t.owner : await hiker(f, await isolatedApi(f));
    const preview = await owner.api.get(`/api/slots/${t.meal.slotId}/seating`, { params: { partySize: 6 } });
    expect(preview.status(), await preview.text()).toBe(200);
    expect(await preview.json()).toEqual({
      slotId: t.meal.slotId, partySize: 6, tables: [{ tableNumber: 1, seats: 6 }],
    });
    const result = await owner.api.post('/api/bookings', { data: {
      slotId: t.meal.slotId, partySize: 6, tables: [{ tableNumber: 1, seats: 6 }], requirements: [],
    } });
    expect(result.status(), await result.text()).toBe(201);
    const replacement = await result.json();
    expect(replacement.id).not.toBe(t.booking.id);
    expect(await seatsFree(t.meal)).toBe(0);
    expect(await snapshot(bBooking.id)).toEqual(bBefore);
    await cancelled(t.booking, t.before);
    if (rebooker === 'original hiker') {
      expect((await ownerList(t.owner)).map(({ id }) => id)).toEqual([replacement.id]);
    }
    await waitForCancellationMail(f, t.owner, t.booking);
  });
}

// Scenario 6: edit is locked but cancel is enabled; historical API cancellation has no cutoff.
test('S6 — cancellation succeeds inside the 48-hour edit window', async ({ page, scenario: f }) => {
  const owner = await hiker(f, page.request);
  const meal = await nearSlot(f);
  const booking = await book(owner, meal);
  const before = await snapshot(booking.id);
  const freeBefore = await seatsFree(meal);
  await openBookings(page);
  await expect(card(page, booking).getByRole('button', { name: 'Edit' })).toBeDisabled();
  await expect(action(page, booking)).toBeEnabled();
  await openDialog(page, booking);
  await cancelThroughBrowser(page, booking);
  await cancelled(booking, before);
  expect(await seatsFree(meal)).toBe(freeBefore + booking.partySize);
  await waitForCancellationMail(f, owner, booking);
});

test('S6 API — a booking from a previous hut date is still cancellable', async ({ scenario: f }) => {
  const owner = await hiker(f, await isolatedApi(f));
  const meal = await nearSlot(f, romeDay(-3));
  const booking = await book(owner, meal);
  const before = await snapshot(booking.id);
  const response = await owner.api.delete(`/api/bookings/${booking.id}`);
  expect(response.status(), await response.text()).toBe(204);
  expect(await response.text()).toBe('');
  await cancelled(booking, before);
  await waitForCancellationMail(f, owner, booking);
});

// Scenario 7: verify the real Mailpit email, not merely the green UI notice.
test('S7 — cancellation email contains original details and server-local cancellation time', async ({ page, scenario: f }) => {
  const t = await setup(f, page, { requirements: [REQ] });
  const beforeMail = await cancellationMail(f.api, t.owner.email, t.booking.id);
  await openBookings(page);
  await openDialog(page, t.booking);
  await cancelThroughBrowser(page, t.booking);
  const row = await cancelled(t.booking, t.before);
  const email = await waitForCancellationMail(f, t.owner, t.booking, beforeMail);
  expect(email.To.map(({ Address }) => Address)).toEqual([t.owner.email]);
  expect(email.Subject).toBe(cancellationSubject(t.booking.id));
  for (const value of [
    `Booking reference: ${reference(t.booking.id)}`,
    'Name: Mara Rossi',
    `Date: ${longDay(t.meal.date)}`,
    `Time: ${t.meal.startsAt.slice(0, 5)}–${t.meal.endsAt.slice(0, 5)}`,
    `Party size: ${t.booking.partySize}`,
    `Cancelled on: ${localMoment(row.booking.cancelled_at)}`,
  ]) expect(email.Text).toContain(value);
  const html = email.HTML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  for (const value of [reference(t.booking.id), 'Mara Rossi', longDay(t.meal.date),
    localMoment(row.booking.cancelled_at)]) expect(html).toContain(value);
  expect(email.Text).toContain('The seats are free again for other guests.');
  expect(email.Text).toContain('We hope to see you at the hut another time.');
  expect(email.Text).not.toContain('Dietary needs');
  expect(email.HTML).not.toContain('Dietary needs');
  expect(email.Text).not.toContain('Table 1');
});

// Scenario 8: second DELETE is a genuine 422; missing booking is a genuine 404.
test('S8 — a stale confirmation after another tab cancels closes with real 422', async ({ page, scenario: f }) => {
  const t = await setup(f, page);
  await openBookings(page);
  await openDialog(page, t.booking);
  const first = await t.owner.api.delete(`/api/bookings/${t.booking.id}`);
  expect(first.status(), await first.text()).toBe(204);
  const already = await snapshot(t.booking.id);
  const mail = await waitForCancellationMail(f, t.owner, t.booking);
  const del = responseFor(page, t.booking.id);
  const reloaded = bookingListResponse(page);
  await confirm(page).click();
  const response = await del;
  expect(response.status(), await response.text()).toBe(422);
  expect(await response.json()).toEqual({ error: 'UnprocessableError', message: 'This booking was already cancelled' });
  expect((await reloaded).status()).toBe(200);
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveText('This booking was already cancelled.');
  await expect(card(page, t.booking)).toHaveCount(0);
  expect(await snapshot(t.booking.id)).toEqual(already);
  expect((await cancellationMail(f.api, t.owner.email, t.booking.id)).length).toBe(1);
  expect(mail.Subject).toBe(cancellationSubject(t.booking.id));
});

test('S8 — a genuinely missing booking closes with a real 404 stale message', async ({ page, scenario: f }) => {
  const t = await setup(f, page);
  await openBookings(page);
  await openDialog(page, t.booking);
  await run('DELETE FROM booking WHERE id = $1', [t.booking.id]); // Isolated fixture, only its own row.
  const del = responseFor(page, t.booking.id);
  const reloaded = bookingListResponse(page);
  await confirm(page).click();
  const response = await del;
  expect(response.status(), await response.text()).toBe(404);
  expect(await response.json()).toEqual({ error: 'NotFoundError', message: `Booking ${t.booking.id} not found` });
  expect((await reloaded).status()).toBe(200);
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveText('This booking is no longer in your list.');
  await expect(card(page, t.booking)).toHaveCount(0);
  await noCancellationMail(f, t.owner, t.booking);
});

// Scenario 9: ownership is enforced by the actual API; UI never exposes B's card to A.
test('S9 — another hiker’s booking is invisible and DELETE returns 404', async ({ page, scenario: f }) => {
  const t = await setup(f, page);
  const other = await hiker(f, await isolatedApi(f));
  const theirBooking = await book(other, t.meal, { partySize: 2 });
  const before = await snapshot(theirBooking.id);
  await openBookings(page);
  await expect(card(page, theirBooking)).toHaveCount(0);
  const response = await t.owner.api.delete(`/api/bookings/${theirBooking.id}`);
  expect(response.status(), await response.text()).toBe(404);
  expect(await response.json()).toEqual({ error: 'NotFoundError', message: `Booking ${theirBooking.id} not found` });
  expect(await snapshot(theirBooking.id)).toEqual(before);
  expect((await ownerList(other)).map(({ id }) => id)).toEqual([theirBooking.id]);
  await unchanged(f, t.owner, t.booking, t.before);
  await noCancellationMail(f, other, theirBooking);
});

// Scenario 10: independent unauthenticated, staff-role, missing-ID and bad-ID API checks.
test('S10 — visitor is routed to login; unauthenticated DELETE is 401', async ({ page, scenario: f }) => {
  const owner = await hiker(f, await isolatedApi(f));
  const meal = await slot(f);
  const booking = await book(owner, meal);
  const before = await snapshot(booking.id);
  const visitor = await isolatedApi(f);
  await page.goto('/bookings');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('status')).toContainText('Log in to see your bookings.');
  const response = await visitor.delete(`/api/bookings/${booking.id}`);
  expect(response.status(), await response.text()).toBe(401);
  expect(await response.json()).toEqual({ error: 'UnauthorizedError', message: 'Authentication required' });
  expect(await snapshot(booking.id)).toEqual(before);
  await noCancellationMail(f, owner, booking);
});

for (const role of ['EMPLOYEE', 'WARDEN']) {
  test(`S10 — ${role} has no cancellation UI and DELETE is forbidden`, async ({ page, scenario: f }) => {
    const owner = await hiker(f, await isolatedApi(f));
    const meal = await slot(f);
    const booking = await book(owner, meal);
    const before = await snapshot(booking.id);
    const actor = await staff(f, role);
    // Log into the browser as staff using the real auth form/session.
    await page.goto('/login');
    await page.getByLabel('Email').fill(actor.email);
    await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/slots/);
    await page.goto('/bookings');
    await expect(page).toHaveURL(/\/slots/);
    await expect(dialog(page)).toHaveCount(0);
    const response = await actor.api.delete(`/api/bookings/${booking.id}`);
    expect(response.status(), await response.text()).toBe(403);
    expect(await response.json()).toEqual({ error: 'ForbiddenError', message: 'Only hikers can cancel bookings' });
    expect(await snapshot(booking.id)).toEqual(before);
    await noCancellationMail(f, owner, booking);
  });
}

test('S10 — missing and malformed booking IDs return real 404/400', async ({ scenario: f }) => {
  const owner = await hiker(f, await isolatedApi(f));
  const meal = await slot(f);
  const booking = await book(owner, meal);
  const before = await snapshot(booking.id);
  const missing = await owner.api.delete('/api/bookings/2147483647');
  expect(missing.status(), await missing.text()).toBe(404);
  expect(await missing.json()).toEqual({ error: 'NotFoundError', message: 'Booking 2147483647 not found' });
  for (const value of ['0', '-1', 'abc', '1.5', '12x']) {
    const response = await owner.api.delete(`/api/bookings/${value}`);
    expect(response.status(), `${value}: ${await response.text()}`).toBe(400);
    expect(await response.json()).toEqual({ error: 'ValidationError', message: 'bookingId must be a positive integer' });
  }
  expect(await snapshot(booking.id)).toEqual(before);
  await noCancellationMail(f, owner, booking);
});

test('S10 — expired session during confirmation navigates to login with no cancellation', async ({ page, scenario: f }) => {
  const t = await setup(f, page);
  await openBookings(page);
  await openDialog(page, t.booking);
  await run('DELETE FROM session WHERE user_id = $1', [t.owner.id]);
  const responsePromise = responseFor(page, t.booking.id);
  await confirm(page).click();
  const response = await responsePromise;
  expect(response.status()).toBe(401);
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('status')).toContainText('Log in to see your bookings.');
  expect(await snapshot(t.booking.id)).toEqual(t.before);
  await noCancellationMail(f, t.owner, t.booking);
});

// Scenario 11: hold a *real* DELETE before forwarding; no hidden duplicate network operation.
test('S11 — pending state blocks duplicate actions and Escape until real 204', async ({ page, scenario: f }) => {
  const t = await setup(f, page);
  await openBookings(page);
  await openDialog(page, t.booking);
  const observed = observeDeletes(page, t.booking.id);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route(`**/api/bookings/${t.booking.id}`, async (route) => {
    if (route.request().method() === 'DELETE') await gate;
    await route.continue();
  });
  const responsePromise = responseFor(page, t.booking.id);
  const listPromise = bookingListResponse(page);
  try {
    // Physical double-click: unlike a second locator.click(), this never waits for the
    // button to become enabled again and cannot masquerade as a retry.
    const bounds = await confirm(page).boundingBox();
    expect(bounds).not.toBeNull();
    await page.mouse.dblclick(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { delay: 50 });
    await expect(dialog(page).getByRole('button', { name: 'Cancelling…' })).toBeDisabled();
    await expect(keep(page)).toBeDisabled();
    await page.keyboard.press('Escape');
    await page.mouse.click(2, 2);
    await expect(dialog(page)).toBeVisible();
    expect(observed).toHaveLength(1);
    await expect(page.getByRole('status').filter({ hasText: 'cancelled. We emailed you a confirmation.' })).toHaveCount(0);
  } finally {
    release(); // A failed assertion must not leave an HTTP request hanging.
  }
  expect((await responsePromise).status()).toBe(204);
  expect((await listPromise).status()).toBe(200);
  await expect(dialog(page)).toHaveCount(0);
  expect(observed).toHaveLength(1);
  await cancelled(t.booking, t.before);
  await waitForCancellationMail(f, t.owner, t.booking);
});

// Scenario 11, UI contract: the injected HTTP 500 was NOT generated by the real backend.
test('S11 UI contract — a controlled 500 leaves the dialog open and real retry succeeds', async ({ page, scenario: f }) => {
  const t = await setup(f, page);
  await openBookings(page);
  await openDialog(page, t.booking);
  const observed = observeDeletes(page, t.booking.id);
  const path = `**/api/bookings/${t.booking.id}`;
  const failOnce = async (route) => route.fulfill({
    status: 500, contentType: 'application/json',
    body: JSON.stringify({ error: 'InternalServerError', message: 'Unexpected error' }),
  });
  await page.route(path, failOnce);
  const failure = responseFor(page, t.booking.id);
  await confirm(page).click();
  expect((await failure).status()).toBe(500);
  await expect(dialog(page).getByRole('alert')).toHaveText(GENERIC);
  await expect(keep(page)).toBeEnabled();
  await expect(confirm(page)).toBeEnabled();
  expect(await snapshot(t.booking.id)).toEqual(t.before);
  await noCancellationMail(f, t.owner, t.booking);
  await page.unroute(path, failOnce);
  const response = await cancelThroughBrowser(page, t.booking);
  expect(response.finished).toBeGreaterThanOrEqual(response.started);
  expect(observed).toHaveLength(2); // One controlled 500, one real 204.
  await cancelled(t.booking, t.before);
  await waitForCancellationMail(f, t.owner, t.booking);
});

// Scenario 12: after cancellation, the real backend list and the page stay empty after reload.
test('S12 — the last booking is removed and the empty state survives a reload', async ({ page, scenario: f }) => {
  const t = await setup(f, page);
  await openBookings(page);
  await openDialog(page, t.booking);
  await cancelThroughBrowser(page, t.booking);
  await expect(page.getByRole('heading', { name: 'No upcoming bookings.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Book a table' })).toBeVisible();
  expect(await ownerList(t.owner)).toEqual([]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'No upcoming bookings.' })).toBeVisible();
  await expect(card(page, t.booking)).toHaveCount(0);
  await cancelled(t.booking, t.before);
  await waitForCancellationMail(f, t.owner, t.booking);
});
