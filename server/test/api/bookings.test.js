import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { clock } from '../../src/clock.js';
import { config } from '../../src/config.js';
import { close, get, run } from '../../src/dao/db.js';
import * as users from '../../src/dao/users.js';
import { hash } from '../../src/passwordHasher.js';
import { cleanBookingData, createSlot, createSlotWithoutTableSet } from '../helpers/bookingFixtures.js';

const PASSWORD = 'password123';
const clean = async () => {
  await cleanBookingData();
  await run("DELETE FROM app_user WHERE email LIKE '%@example.com'");
};

beforeEach(clean);
afterAll(async () => {
  await clean();
  await close();
});

// A logged-in agent. Hikers sign up; an employee is created in the database.
async function loggedIn(email, role = 'HIKER') {
  const agent = request.agent(app);
  if (role === 'HIKER') {
    await agent.post('/api/auth/register').send({ firstName: 'A', lastName: 'B', email, password: PASSWORD });
  } else {
    await users.insert({ firstName: 'A', lastName: 'B', email, phone: null, role, passwordHash: await hash(PASSWORD) });
    await agent.post('/api/auth/login').send({ email, password: PASSWORD });
  }
  return agent;
}

// The body of a booking: the tables are the ones of the preview, or the ones given
const bodyOf = (slot, partySize, tables) => ({ slotId: slot.slotId, partySize, tables });

const slotOf = async (slotId) => (await request(app).get('/api/slots')).body.find((s) => s.slotId === slotId);

describe('GET /api/slots', () => {
  it('is public and takes no parameters: lists the slots with seats, times as HH:MM and when booking closes', async () => {
    const slot = await createSlot({ date: '2090-06-10', seats: [4, 2], startsAt: '12:00', endsAt: '13:00' });

    const res = await request(app).get('/api/slots');

    expect(res.status).toBe(200);
    expect(res.body.find((s) => s.slotId === slot.slotId)).toEqual({
      slotId: slot.slotId,
      date: '2090-06-10',
      startsAt: '12:00',
      endsAt: '13:00',
      freeSeats: 6,
      bookingOpen: true,
      bookingClosesAt: '2090-06-10T10:00',
    });
  });

  it('lists full slots and slots without tables with 0 free seats', async () => {
    const full = await createSlot({ date: '2090-06-11', seats: [2] });
    const noTables = await createSlotWithoutTableSet('2090-06-11');
    const agent = await loggedIn('slots.full@example.com');
    await agent.post('/api/bookings').send(bodyOf(full, 2, [{ tableNumber: 1, seats: 2 }]));

    expect((await slotOf(full.slotId)).freeSeats).toBe(0);
    expect((await slotOf(noTables.slotId)).freeSeats).toBe(0);
  });

  it('starts from today (in the time zone of the hut): earlier days are not listed', async () => {
    const old = await createSlot({ date: '2001-05-05' });
    const body = (await request(app).get('/api/slots')).body;

    expect(body.find((s) => s.slotId === old.slotId)).toBeUndefined();
    expect(body.every((s) => s.date >= clock.today(config.hutTimeZone))).toBe(true);
  });

  it('lists a slot of today that is closed, marked as not open', async () => {
    // a meal in one hour: booking closed an hour ago. The date and the time are those of the hut.
    const [date, time] = clock.localDateTime(Date.now() + 60 * 60 * 1000, config.hutTimeZone).split('T');
    const soon = await createSlot({ date, startsAt: time, endsAt: '23:59' });

    const listed = await slotOf(soon.slotId);
    expect(listed.bookingOpen).toBe(false);
    expect(listed.bookingClosesAt < clock.localDateTime(Date.now(), config.hutTimeZone)).toBe(true);

    const agent = await loggedIn('slots.closed@example.com');
    const res = await agent.post('/api/bookings').send(bodyOf(soon, 1, [{ tableNumber: 1, seats: 1 }]));
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: 'UnprocessableError', message: 'Bookings close two hours before the meal' });
  });
});

describe('GET /api/slots/:slotId/seating', () => {
  it('is public and says the tables the party would get, without booking', async () => {
    const slot = await createSlot({ seats: [4, 2] });

    const res = await request(app).get(`/api/slots/${slot.slotId}/seating`).query({ partySize: 6 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      slotId: slot.slotId,
      partySize: 6,
      tables: [{ tableNumber: 1, seats: 4 }, { tableNumber: 2, seats: 2 }],
    });
    expect((await slotOf(slot.slotId)).freeSeats).toBe(6);
  });

  it('uses the table with the number, not its id', async () => {
    const slot = await createSlot({ seats: [6, 3] });
    const res = await request(app).get(`/api/slots/${slot.slotId}/seating`).query({ partySize: 3 });
    expect(res.body.tables).toEqual([{ tableNumber: 2, seats: 3 }]);
  });

  it('answers 400, 404, 409 and 422', async () => {
    const slot = await createSlot({ seats: [2] });
    const noTables = await createSlotWithoutTableSet();

    const bad = await request(app).get(`/api/slots/${slot.slotId}/seating`).query({ partySize: 0 });
    expect(bad.status).toBe(400);
    expect(bad.body).toEqual({ error: 'ValidationError', message: 'partySize must be a positive integer' });

    expect((await request(app).get('/api/slots/999999999/seating').query({ partySize: 1 })).status).toBe(404);
    const noSeats = await request(app).get(`/api/slots/${slot.slotId}/seating`).query({ partySize: 3 });
    expect(noSeats.status).toBe(409);
    expect(noSeats.body.code).toBe('NO_SEATS');
    expect((await request(app).get(`/api/slots/${noTables.slotId}/seating`).query({ partySize: 1 })).status).toBe(422);
  });
});

describe('POST /api/bookings', () => {
  const T = (tableNumber, seats) => ({ tableNumber, seats });
  const preview = async (slot, partySize) =>
    (await request(app).get(`/api/slots/${slot.slotId}/seating`).query({ partySize })).body.tables;

  it('books the tables of the preview for a logged-in hiker and says them', async () => {
    const slot = await createSlot({ seats: [4, 2] });
    const agent = await loggedIn('book.ok@example.com');

    const tables = await preview(slot, 2);
    const res = await agent.post('/api/bookings').send(bodyOf(slot, 2, tables));

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number), date: slot.date, slotId: slot.slotId, partySize: 2, tables: [T(2, 2)],
    });
    const seats = await get(
      'SELECT hut_table_id AS "tableId", seat_count AS "seatCount" FROM booking_table WHERE booking_id = $1',
      [res.body.id],
    );
    expect(seats).toEqual({ tableId: slot.tableIds[1], seatCount: 2 });
  });

  it('answers 409 for other tables than the preview, and books nothing', async () => {
    const slot = await createSlot({ seats: [4, 2] });
    const agent = await loggedIn('book.asked@example.com');

    expect(await preview(slot, 2)).toEqual([T(2, 2)]);
    const res = await agent.post('/api/bookings').send(bodyOf(slot, 2, [T(1, 2)]));

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: 'ConflictError',
      code: 'TABLES_CHANGED',
      message: 'The chosen tables are no longer the ones proposed for this party',
    });
    expect((await slotOf(slot.slotId)).freeSeats).toBe(6);
  });

  it('splits a party over the tables and then the slot shows the seats left', async () => {
    const slot = await createSlot({ seats: [2, 2, 2] });
    const agent = await loggedIn('book.split@example.com');

    const res = await agent.post('/api/bookings').send(bodyOf(slot, 5, await preview(slot, 5)));

    expect(res.status).toBe(201);
    expect(res.body.tables).toEqual([T(1, 2), T(2, 2), T(3, 1)]);
    expect((await slotOf(slot.slotId)).freeSeats).toBe(1);
  });

  it('answers 401 without a login', async () => {
    const slot = await createSlot();
    const res = await request(app).post('/api/bookings').send(bodyOf(slot, 2, [T(1, 2)]));
    expect(res.status).toBe(401);
  });

  it('answers 403 for an employee', async () => {
    const slot = await createSlot();
    const agent = await loggedIn('book.employee@example.com', 'EMPLOYEE');
    const res = await agent.post('/api/bookings').send(bodyOf(slot, 2, [T(1, 2)]));
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'ForbiddenError', message: 'Only hikers can create bookings' });
  });

  it('answers 400 for invalid input', async () => {
    const agent = await loggedIn('book.invalid@example.com');
    const zero = await agent.post('/api/bookings').send({ slotId: 1, partySize: 0, tables: [T(1, 1)] });
    expect(zero.status).toBe(400);
    expect(zero.body).toEqual({ error: 'ValidationError', message: 'partySize must be a positive integer' });

    const noTables = await agent.post('/api/bookings').send({ slotId: 1, partySize: 2 });
    expect(noTables.status).toBe(400);
    expect(noTables.body.message).toBe('tables must be a non-empty array');

    const wrongSum = await agent.post('/api/bookings').send({ slotId: 1, partySize: 3, tables: [T(1, 2)] });
    expect(wrongSum.status).toBe(400);
  });

  it('answers 409 when a table has not enough free seats, and 201 for the last seats', async () => {
    const slot = await createSlot({ seats: [2, 1] });
    const agent = await loggedIn('book.full@example.com');

    const tooMany = await agent.post('/api/bookings').send(bodyOf(slot, 3, [T(2, 3)]));
    expect(tooMany.status).toBe(409);
    expect(tooMany.body).toMatchObject({ error: 'ConflictError', code: 'TABLES_CHANGED' });
    expect((await slotOf(slot.slotId)).freeSeats).toBe(3);

    const exact = await agent.post('/api/bookings').send(bodyOf(slot, 3, [T(1, 2), T(2, 1)]));
    expect(exact.status).toBe(201);
  });

  it('answers 409 when someone booked the tables of the preview in the meantime, and a new preview works', async () => {
    const slot = await createSlot({ seats: [2, 2] });
    const first = await loggedIn('book.late1@example.com');
    const second = await loggedIn('book.late2@example.com');

    const tables = await preview(slot, 2);
    expect((await first.post('/api/bookings').send(bodyOf(slot, 2, tables))).status).toBe(201);

    const late = await second.post('/api/bookings').send(bodyOf(slot, 2, tables));
    expect(late.status).toBe(409);
    expect(late.body.code).toBe('TABLES_CHANGED');
    expect(await get('SELECT COUNT(*)::INT AS n FROM booking WHERE slot_id = $1', [slot.slotId])).toEqual({ n: 1 });
    expect((await second.post('/api/bookings').send(bodyOf(slot, 2, await preview(slot, 2)))).status).toBe(201);
  });

  it('answers 409 for a table that is not in the slot', async () => {
    const slot = await createSlot({ seats: [4] });
    const agent = await loggedIn('book.nosuch@example.com');
    const res = await agent.post('/api/bookings').send(bodyOf(slot, 2, [T(9, 2)]));
    expect(res.status).toBe(409);
  });

  it('answers 409 NO_SEATS when the party does not fit in the slot any more', async () => {
    const slot = await createSlot({ seats: [2] });
    const first = await loggedIn('book.nospace1@example.com');
    const second = await loggedIn('book.nospace2@example.com');

    expect((await first.post('/api/bookings').send(bodyOf(slot, 2, [T(1, 2)]))).status).toBe(201);
    const res = await second.post('/api/bookings').send(bodyOf(slot, 2, [T(1, 2)]));

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'ConflictError', code: 'NO_SEATS', message: 'Not enough free seats' });
  });

  it('answers 404 for an unknown slot, like the preview, and 422 for a slot with no table set', async () => {
    const noSet = await createSlotWithoutTableSet();
    const agent = await loggedIn('book.unknown@example.com');

    const missing = await agent.post('/api/bookings').send({ slotId: 999999999, partySize: 1, tables: [T(1, 1)] });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: 'NotFoundError', message: 'Slot 999999999 not found' });

    const withoutSet = await agent.post('/api/bookings').send(bodyOf(noSet, 1, [T(1, 1)]));
    expect(withoutSet.status).toBe(422);
  });

  it('answers 422 when the meal has already passed', async () => {
    const slot = await createSlot({ date: '2001-05-05' });
    const agent = await loggedIn('book.closed@example.com');
    const res = await agent.post('/api/bookings').send(bodyOf(slot, 1, [T(1, 1)]));
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: 'UnprocessableError', message: 'Bookings close two hours before the meal' });
  });

  it('answers 422 for a second booking of the same slot, and a different hiker can still book', async () => {
    const slot = await createSlot({ seats: [6] });
    const first = await loggedIn('book.twice@example.com');
    const second = await loggedIn('book.second@example.com');
    const body = bodyOf(slot, 1, [T(1, 1)]);

    expect((await first.post('/api/bookings').send(body)).status).toBe(201);
    const again = await first.post('/api/bookings').send(body);
    expect(again.status).toBe(422);
    expect(again.body.message).toBe('You already have a booking for this slot');
    expect((await second.post('/api/bookings').send(body)).status).toBe(201);
  });

  it('never gives the same seat twice when hikers book at the same time', async () => {
    const slot = await createSlot({ seats: [4] });
    const hikers = await Promise.all(['a', 'b', 'c', 'd'].map((n) => loggedIn(`book.race.${n}@example.com`)));

    const results = await Promise.all(hikers.map((agent) =>
      agent.post('/api/bookings').send(bodyOf(slot, 2, [T(1, 2)]))));

    expect(results.map((r) => r.status).sort()).toEqual([201, 201, 409, 409]);
    const used = await get(
      'SELECT SUM(seat_count)::INT AS seats FROM booking_table WHERE slot_id = $1', [slot.slotId],
    );
    expect(used.seats).toBe(4);
  });
});
