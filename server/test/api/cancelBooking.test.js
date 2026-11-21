// MH-109: real HTTP, use cases, PostgreSQL, nodemailer and the existing SMTP inbox.
// Only the clock is fixed. Concurrent requests are coordinated with a real PostgreSQL row lock.
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { startSmtpInbox } from '../helpers/smtpInbox.js';

const inbox = await startSmtpInbox();
Object.assign(process.env, {
  SMTP_HOST: '127.0.0.1', SMTP_PORT: String(inbox.port), SMTP_USER: '', SMTP_PASSWORD: '',
  MAIL_FROM: 'QUOTA <no-reply@quota.example>', HUT_TIME_ZONE: 'Europe/Rome',
});
const { app } = await import('../../src/app.js');
const { clock } = await import('../../src/clock.js');
const { config } = await import('../../src/config.js');
const { all, close, get, run } = await import('../../src/dao/db.js');
const bookings = await import('../../src/dao/bookings.js');
const slots = await import('../../src/dao/slots.js');
const users = await import('../../src/dao/users.js');
const { hash } = await import('../../src/passwordHasher.js');
const { cleanBookingData, createSlot } = await import('../helpers/bookingFixtures.js');

const PASSWORD = 'password123';
const NOW = new Date('2090-07-14T09:32:00Z');
// Several cases perform three real SMTP exchanges; keep their I/O budget local to this file.
const SMTP_TEST_OPTIONS = { timeout: 15_000 };
const userIds = [];
const reference = (id) => `QUOTA-${String(id).padStart(5, '0')}`;
const alreadyCancelled = { error: 'UnprocessableError', message: 'This booking was already cancelled' };

async function clean() {
  await cleanBookingData();
  // The prefix also catches a registration that persisted its row before an HTTP assertion failed.
  await run("DELETE FROM app_user WHERE email LIKE 'mh109.%@example.com' OR id = ANY($1::INTEGER[])", [userIds]);
  userIds.length = 0;
}

beforeEach(async () => {
  await clean();
  inbox.clear();
  vi.spyOn(clock, 'now').mockReturnValue(NOW);
  vi.spyOn(clock, 'after').mockImplementation((ms) => new Date(NOW.getTime() + ms));
  vi.spyOn(clock, 'today').mockReturnValue('2090-07-14');
});

afterEach(async () => {
  vi.restoreAllMocks();
  await clean();
});
afterAll(async () => {
  try {
    await clean();
  } finally {
    await close();
    await inbox.stop();
  }
});

async function loggedIn(role = 'HIKER', names = {}) {
  const email = `mh109.${randomUUID()}@example.com`;
  const agent = request.agent(app);
  if (role === 'HIKER') {
    await agent.post('/api/auth/register').send({
      firstName: 'Giulia', lastName: 'Rossi', ...names, email, password: PASSWORD,
    }).expect(201);
  } else {
    await users.insert({
      firstName: 'Test', lastName: 'Staff', email, phone: null, role, passwordHash: await hash(PASSWORD),
    });
  }
  const stored = await users.findByEmail(email);
  userIds.push(stored.id);
  if (role !== 'HIKER') await agent.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return { agent, user: { id: stored.id, role: stored.role }, email };
}

async function book(agent, slot, partySize, requirements = []) {
  const preview = await request(app).get(`/api/slots/${slot.slotId}/seating`).query({ partySize }).expect(200);
  const response = await agent.post('/api/bookings').send({
    slotId: slot.slotId, partySize, tables: preview.body.tables, requirements,
  }).expect(201);
  return response.body;
}

async function fixture({ seats = [6], date = '2090-07-17', partySize = 4, requirements = [], names = {} } = {}) {
  const owner = await loggedIn('HIKER', names);
  const slot = await createSlot({ date, startsAt: '13:00', endsAt: '14:00', seats });
  const capacity = seats.reduce((sum, count) => sum + count, 0);
  expect(await freeSeats(slot)).toBe(capacity);
  const booking = await book(owner.agent, slot, partySize, requirements);
  expect(await freeSeats(slot)).toBe(capacity - partySize);
  expect(inbox.emails).toHaveLength(1);
  expect(inbox.emails[0].subject).toBe(`Your table is booked (${reference(booking.id)})`);
  inbox.clear(); // Every later email assertion counts only cancellation notifications.
  return { ...owner, slot, booking, path: `/api/bookings/${booking.id}` };
}

async function storedBooking(id) {
  return {
    row: await get('SELECT * FROM booking WHERE id = $1', [id]),
    assignments: await all('SELECT * FROM booking_table WHERE booking_id = $1 ORDER BY hut_table_id', [id]),
    requirements: await all('SELECT * FROM booking_requirement WHERE booking_id = $1 ORDER BY id', [id]),
  };
}

async function freeSeats(slot) {
  const response = await request(app).get('/api/slots').expect(200);
  const listed = response.body.find(({ slotId }) => slotId === slot.slotId);
  expect(listed).toBeDefined();
  return listed.freeSeats;
}

async function expectCancelled(t, before) {
  const persisted = await storedBooking(t.booking.id);
  expect(persisted).toEqual({ ...before, row: { ...before.row, cancelled_at: NOW } });
  expect(await bookings.hasActiveBooking(t.user.id, t.slot.slotId)).toBe(false);
  expect((await t.agent.get('/api/bookings').expect(200)).body.map(({ id }) => id)).not.toContain(t.booking.id);
}

describe('DELETE /api/bookings/:bookingId — persistence and seats (MH-08)', SMTP_TEST_OPTIONS, () => {
  it('returns empty 204, keeps historical details and releases exactly the occupied seats immediately', async () => {
    const t = await fixture({ requirements: [{ diets: ['VEGAN'], allergies: ['PEANUTS'], otherRequests: 'No onions' }] });
    const before = await storedBooking(t.booking.id);
    expect(before.row.cancelled_at).toBeNull();
    expect(before.requirements).toHaveLength(1);
    expect((await t.agent.get('/api/bookings').expect(200)).body.map(({ id }) => id)).toContain(t.booking.id);
    expect(await freeSeats(t.slot)).toBe(6 - t.booking.partySize);

    const response = await t.agent.delete(t.path).expect(204);

    expect(response.text).toBe('');
    expect(response.body).toEqual({});
    await expectCancelled(t, before);
    expect(await freeSeats(t.slot)).toBe(6);
    expect(await slots.findAvailableTablesBySlotId(t.slot.slotId)).toEqual([
      { tableId: t.slot.tableIds[0], tableNumber: 1, seatCapacity: 6, freeSeats: 6 },
    ]);
  });

  it('allows the same hiker to rebook, while keeping exactly one active booking per slot', async () => {
    const t = await fixture();
    await t.agent.delete(t.path).expect(204);
    const cancelled = await storedBooking(t.booking.id);
    expect(await bookings.hasActiveBooking(t.user.id, t.slot.slotId)).toBe(false);

    const replacement = await book(t.agent, t.slot, 4);

    expect(replacement.id).not.toBe(t.booking.id);
    expect(await bookings.hasActiveBooking(t.user.id, t.slot.slotId)).toBe(true);
    expect((await t.agent.get('/api/bookings').expect(200)).body.map(({ id }) => id)).toEqual([replacement.id]);
    expect(await freeSeats(t.slot)).toBe(2);
    const duplicate = await t.agent.post('/api/bookings').send({
      slotId: t.slot.slotId, partySize: 1, tables: [{ tableNumber: 1, seats: 1 }],
    }).expect(422);
    expect(duplicate.body).toEqual({ error: 'UnprocessableError', message: 'You already have a booking for this slot' });
    expect(await storedBooking(t.booking.id)).toEqual(cancelled);
    expect(await get('SELECT COUNT(*)::INTEGER AS count FROM booking WHERE hiker_id = $1 AND slot_id = $2 AND cancelled_at IS NULL',
      [t.user.id, t.slot.slotId])).toEqual({ count: 1 });
  });

  it('lets another hiker reserve every released seat in a previously full slot', async () => {
    const t = await fixture({ seats: [2, 2], partySize: 4 });
    const other = await loggedIn();
    expect(await freeSeats(t.slot)).toBe(0);
    const full = await request(app).get(`/api/slots/${t.slot.slotId}/seating`).query({ partySize: 1 }).expect(409);
    expect(full.body).toEqual({ error: 'ConflictError', message: 'Not enough free seats', code: 'NO_SEATS' });
    await t.agent.delete(t.path).expect(204);
    expect(await freeSeats(t.slot)).toBe(4);

    const replacement = await book(other.agent, t.slot, 4);

    expect(await freeSeats(t.slot)).toBe(0);
    expect((await bookings.findById(replacement.id))).toMatchObject({ hikerId: other.user.id, cancelled: false, partySize: 4 });
    expect((await storedBooking(t.booking.id)).assignments).toHaveLength(2);
  });

  it('releases only its own seats in a shared table and preserves other bookings and assignments', async () => {
    const t = await fixture({ seats: [8], partySize: 3 });
    const other = await loggedIn();
    const otherBooking = await book(other.agent, t.slot, 2);
    const original = await storedBooking(t.booking.id);
    const unaffected = await storedBooking(otherBooking.id);
    inbox.clear();
    expect(await freeSeats(t.slot)).toBe(3);

    await t.agent.delete(t.path).expect(204);

    await expectCancelled(t, original);
    expect(await storedBooking(otherBooking.id)).toEqual(unaffected);
    expect(await freeSeats(t.slot)).toBe(6);
    expect(await slots.findAvailableTablesBySlotId(t.slot.slotId)).toEqual([
      { tableId: t.slot.tableIds[0], tableNumber: 1, seatCapacity: 8, freeSeats: 6 },
    ]);
    expect((await other.agent.get('/api/bookings').expect(200)).body.map(({ id }) => id)).toEqual([otherBooking.id]);
    expect(inbox.emails).toHaveLength(1);
    expect(inbox.emails[0].to).toBe(t.email);
  });

  it('rejects a second cancellation without changing its timestamp or releasing seats twice', async () => {
    const t = await fixture();
    await t.agent.delete(t.path).expect(204);
    const cancelled = await storedBooking(t.booking.id);
    vi.spyOn(clock, 'now').mockReturnValue(new Date(NOW.getTime() + 60_000));

    const second = await t.agent.delete(t.path).expect(422);

    expect(second.body).toEqual(alreadyCancelled);
    expect(await storedBooking(t.booking.id)).toEqual(cancelled);
    expect(await freeSeats(t.slot)).toBe(6);
    expect(inbox.emails).toHaveLength(1);
  });

  it('rejects PATCH after cancellation, retaining its timestamp, details and free seats', async () => {
    const t = await fixture();
    await t.agent.delete(t.path).expect(204);
    const cancelled = await storedBooking(t.booking.id);

    const changed = await t.agent.patch(t.path).send({ partySize: 1 }).expect(422);

    expect(changed.body).toEqual({ error: 'UnprocessableError', message: 'This booking was cancelled' });
    expect(await storedBooking(t.booking.id)).toEqual(cancelled);
    expect(await freeSeats(t.slot)).toBe(6);
    expect(inbox.emails).toHaveLength(1);
  });
});

describe('DELETE booking — authorization and validation', SMTP_TEST_OPTIONS, () => {
  it.each(['unauthenticated', 'EMPLOYEE', 'WARDEN', 'another hiker', 'nonexistent'])('rejects %s without changing stored data, seats or email', async (scenario) => {
    const t = await fixture();
    const before = await storedBooking(t.booking.id);
    let agent = t.agent;
    let path = t.path;
    let status;
    let body;
    if (scenario === 'unauthenticated') {
      agent = request(app);
      status = 401;
      body = { error: 'UnauthorizedError', message: 'Authentication required' };
    } else if (['EMPLOYEE', 'WARDEN'].includes(scenario)) {
      agent = (await loggedIn(scenario)).agent;
      status = 403;
      body = { error: 'ForbiddenError', message: 'Only hikers can cancel bookings' };
    } else {
      status = 404;
      if (scenario === 'another hiker') agent = (await loggedIn()).agent;
      if (scenario === 'nonexistent') path = '/api/bookings/2147483648'; // Above the INTEGER column range, valid API ID.
      body = { error: 'NotFoundError', message: `Booking ${path.split('/').at(-1)} not found` };
    }

    const response = await agent.delete(path).expect(status);

    expect(response.body).toEqual(body);
    expect(await storedBooking(t.booking.id)).toEqual(before);
    expect(await bookings.hasActiveBooking(t.user.id, t.slot.slotId)).toBe(true);
    expect(await freeSeats(t.slot)).toBe(2);
    expect((await t.agent.get('/api/bookings').expect(200)).body.map(({ id }) => id)).toContain(t.booking.id);
    expect(inbox.emails).toEqual([]);
  });

  it.each(['0', '-1', 'abc', '1.5', '45abc', '1e2', '0x2a', '01', '+1', ' 45', '45 ', '1/2', '9007199254740992'])(
    'rejects invalid booking ID %j with the documented 400 and no side effects', async (id) => {
      const t = await fixture();
      const before = await storedBooking(t.booking.id);

      const response = await t.agent.delete(`/api/bookings/${encodeURIComponent(id)}`).expect(400);

      expect(response.body).toEqual({ error: 'ValidationError', message: 'bookingId must be a positive integer' });
      expect(await storedBooking(t.booking.id)).toEqual(before);
      expect(await freeSeats(t.slot)).toBe(2);
      expect(inbox.emails).toEqual([]);
    },
  );
});

describe('DELETE booking — no editing deadline', SMTP_TEST_OPTIONS, () => {
  it.each([
    ['exactly 48 hours before the meal', '2090-07-16T11:00:00Z'],
    ['one millisecond past the editing deadline', '2090-07-16T11:00:00.001Z'],
    ['one hour before the meal', '2090-07-18T10:00:00Z'],
    ['after the booking’s meal', '2090-07-19T09:32:00Z'],
  ])('accepts cancellation %s', async (_label, instant) => {
    const cancelledAt = new Date(instant);
    // Authenticate and book with the initial clock, then establish a valid session at the later
    // instant. This avoids confusing the editing deadline with session expiration.
    const t = await fixture({ date: '2090-07-18' });
    vi.spyOn(clock, 'now').mockReturnValue(cancelledAt);
    vi.spyOn(clock, 'after').mockImplementation((ms) => new Date(cancelledAt.getTime() + ms));
    vi.spyOn(clock, 'today').mockReturnValue(instant.slice(0, 10));
    await t.agent.post('/api/auth/login').send({ email: t.email, password: PASSWORD }).expect(200);
    const before = await storedBooking(t.booking.id);
    const patch = await t.agent.patch(t.path).send({ partySize: 2 });
    // Exactly at the boundary MH-06 allows changes; every later instant must reject them.
    if (instant === '2090-07-16T11:00:00Z') {
      expect(patch.status).toBe(200);
    } else {
      expect(patch.status).toBe(422);
      expect(patch.body).toEqual({ error: 'UnprocessableError', message: 'Bookings can be changed until 48 hours before the meal' });
      expect(await storedBooking(t.booking.id)).toEqual(before);
    }
    const original = await storedBooking(t.booking.id);
    inbox.clear();

    await t.agent.delete(t.path).expect(204);

    expect(await storedBooking(t.booking.id)).toEqual({ ...original, row: { ...original.row, cancelled_at: cancelledAt } });
    expect(await bookings.hasActiveBooking(t.user.id, t.slot.slotId)).toBe(false);
    expect((await slots.findAvailableTablesBySlotId(t.slot.slotId))[0].freeSeats).toBe(6);
    expect(inbox.emails).toHaveLength(1);
  });
});

describe('DELETE booking — concurrent cancellations', SMTP_TEST_OPTIONS, () => {
  it('commits one cancellation and sends one email when both requests have read an active booking', async () => {
    const t = await fixture({ seats: [4], partySize: 4 });
    const before = await storedBooking(t.booking.id);
    const blocker = new pg.Client({ connectionString: config.databaseUrl });
    let requests = [];
    await blocker.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query('SELECT id FROM booking WHERE id = $1 FOR UPDATE', [t.booking.id]);
      // Reading is still possible, but both real UPDATEs must wait for this lock. No DAO or
      // use-case replacement is involved. The HTTP requests start when their promises are consumed.
      requests = [t.agent.delete(t.path), t.agent.delete(t.path)].map((req) => req.then((response) => response));
      let waiting = 0;
      for (let attempt = 0; attempt < 2000 && waiting !== 2; attempt += 1) {
        const row = await get(`
          SELECT COUNT(*)::INTEGER AS count FROM pg_stat_activity
          WHERE datname = current_database() AND pid <> pg_backend_pid()
            AND cardinality(pg_blocking_pids(pid)) > 0
            AND pid IN (
              SELECT pid FROM pg_locks
              WHERE relation = 'booking'::REGCLASS AND mode = 'RowExclusiveLock' AND granted
            )
        `);
        waiting = row.count;
      }
      expect(waiting, 'Both cancellation UPDATEs must be waiting on real PostgreSQL locks').toBe(2);
    } finally {
      await blocker.query('ROLLBACK');
      await blocker.end();
      // Drain requests even when the coordination assertion fails, before fixture cleanup.
      await Promise.allSettled(requests);
    }
    const responses = await Promise.all(requests);

    expect(responses.map(({ status }) => status).sort()).toEqual([204, 422]);
    expect(responses.find(({ status }) => status === 204).text).toBe('');
    expect(responses.find(({ status }) => status === 422).body).toEqual(alreadyCancelled);
    await expectCancelled(t, before);
    expect(await freeSeats(t.slot)).toBe(4);
    expect(inbox.emails).toHaveLength(1);
    expect(inbox.emails[0].subject).toBe(`Your booking has been cancelled (${reference(t.booking.id)})`);
  });
});

describe('DELETE booking — SMTP cancellation email', SMTP_TEST_OPTIONS, () => {
  it('delivers the agreed original details, cancellation time and no dietary needs or table numbers', async () => {
    const t = await fixture({ seats: [2, 2], partySize: 4, requirements: [{ diets: ['VEGAN'], allergies: ['PEANUTS'], otherRequests: 'No onions' }] });

    await t.agent.delete(t.path).expect(204);

    expect(inbox.emails).toHaveLength(1);
    const [email] = inbox.emails;
    expect(email.envelope).toEqual({ from: 'no-reply@quota.example', to: [t.email] });
    expect(email.from).toEqual({ name: 'QUOTA', address: 'no-reply@quota.example' });
    expect(email.to).toBe(t.email);
    expect(email.subject).toBe(`Your booking has been cancelled (${reference(t.booking.id)})`);
    expect(email.text).toBe([
      'Hello Giulia Rossi,', '',
      `Your booking ${reference(t.booking.id)} has been cancelled. The seats are free again for other guests.`, '',
      `Booking reference: ${reference(t.booking.id)}`, 'Name: Giulia Rossi', 'Date: 17 July 2090',
      'Time: 13:00\u201314:00', 'Party size: 4', 'Cancelled on: 14 July 2090, 11:32', '',
      'We hope to see you at the hut another time.',
    ].join('\n'));
    for (const [label, value] of [
      ['Booking reference', reference(t.booking.id)], ['Name', 'Giulia Rossi'], ['Date', '17 July 2090'],
      ['Time', '13:00\u201314:00'], ['Party size', '4'], ['Cancelled on', '14 July 2090, 11:32'],
    ]) {
      expect(email.html).toContain(`>${label}</td>`);
      expect(email.html).toContain(`>${value}</td>`);
    }
    expect(email.html).toContain('We hope to see you at the hut another time.');
    for (const body of [email.text, email.html]) {
      expect(body).not.toMatch(/dietary|vegan|peanuts|no onions|allerg/i);
      expect(body).not.toMatch(/table\s*(number|assignment|n\.|#)?\s*\d/i);
    }
  });

  it('delivers HTML-escaped user text through SMTP', async () => {
    const t = await fixture({ names: { firstName: '<b>Giulia</b>', lastName: 'O\'Neil & Co' } });
    await t.agent.delete(t.path).expect(204);
    expect(inbox.emails).toHaveLength(1);
    const [email] = inbox.emails;
    expect(email.text).toContain('Hello <b>Giulia</b> O\'Neil & Co,');
    expect(email.html).toContain('&lt;b&gt;Giulia&lt;/b&gt; O&#39;Neil &amp; Co');
    expect(email.html).not.toContain('<b>Giulia</b>');
  });

  it('keeps cancellation, released seats and empty 204 when SMTP refuses delivery', async () => {
    const t = await fixture();
    const before = await storedBooking(t.booking.id);
    inbox.refuse = true;
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await t.agent.delete(t.path).expect(204);

    await expectCancelled(t, before);
    expect(await freeSeats(t.slot)).toBe(6);
    expect(inbox.emails).toEqual([]);
    expect(log).toHaveBeenCalledExactlyOnceWith(
      `The email about the cancellation of booking ${t.booking.id} was not sent:`,
      expect.objectContaining({ responseCode: 550 }),
    );
    const retry = await t.agent.delete(t.path).expect(422);
    expect(retry.body).toEqual(alreadyCancelled);
    expect(inbox.emails).toEqual([]);
    expect(log).toHaveBeenCalledTimes(1);
  });
});

describe('temporary hiker cancellation — service integration', SMTP_TEST_OPTIONS, () => {
  it('cancels and frees seats without an email for a temporary hiker who cannot log in', async () => {
    // Temporary hikers cannot authenticate, so exercise the real backend service with persisted
    // fixtures rather than creating an impossible login session or mocking authentication.
    const { makeCancelBooking } = await import('../../src/usecases/cancelBooking.js');
    const { makeCancelBookingAndNotify } = await import('../../src/usecases/cancelBookingAndNotify.js');
    const { makeMailer } = await import('../../src/mailer.js');
    const temporary = await users.insertTemporaryHiker({ firstName: 'Temporary', lastName: 'Hiker', phone: null });
    userIds.push(temporary.id);
    const slot = await createSlot({ date: '2090-07-17', seats: [4] });
    const booking = await bookings.createWithTableAssignments({
      hikerId: temporary.id, slotId: slot.slotId, partySize: 3,
      tableAssignments: [{ tableId: slot.tableIds[0], seatCount: 3 }],
    });
    const before = await storedBooking(booking.id);
    expect(await freeSeats(slot)).toBe(1);
    const cancel = makeCancelBookingAndNotify({
      cancelBooking: makeCancelBooking({ bookings, clock }),
      bookings, clock, hutTimeZone: config.hutTimeZone, mailer: makeMailer(config.mail),
    });

    await expect(cancel({ user: { id: temporary.id, role: 'HIKER' }, bookingId: booking.id }))
      .resolves.toEqual({ bookingId: booking.id, cancelledAt: NOW });

    expect(await storedBooking(booking.id)).toEqual({ ...before, row: { ...before.row, cancelled_at: NOW } });
    expect(await freeSeats(slot)).toBe(4);
    expect(await bookings.hasActiveBooking(temporary.id, slot.slotId)).toBe(false);
    expect(inbox.emails).toEqual([]);
  });
});
