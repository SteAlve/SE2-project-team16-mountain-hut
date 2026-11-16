import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { clock } from '../../src/clock.js';
import { config } from '../../src/config.js';
import { close, get, run } from '../../src/dao/db.js';
import * as bookingDao from '../../src/dao/bookings.js';
import * as slots from '../../src/dao/slots.js';
import * as users from '../../src/dao/users.js';
import { hash } from '../../src/passwordHasher.js';
import { cleanBookingData, createSlot, createSlotWithoutTableSet } from '../helpers/bookingFixtures.js';

const PASSWORD = 'password123';
const clean = async () => {
  await cleanBookingData();
  await run("DELETE FROM app_user WHERE email LIKE '%@example.com'");
};

beforeEach(clean);
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await clean();
  await close();
});

// A logged-in agent. Hikers sign up; an employee is created in the database.
async function loggedIn(email, role = 'HIKER') {
  const agent = request.agent(app);
  if (role === 'HIKER') {
    await agent.post('/api/auth/register').send({ firstName: 'A', lastName: 'B', email, password: PASSWORD }).expect(201);
  } else {
    await users.insert({ firstName: 'A', lastName: 'B', email, phone: null, role, passwordHash: await hash(PASSWORD) });
    await agent.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
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
    await agent.post('/api/bookings').send(bodyOf(full, 2, [{ tableNumber: 1, seats: 2 }])).expect(201);

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
    const date = '2090-06-12';
    const now = clock.at(date, '11:00', config.hutTimeZone);
    vi.spyOn(clock, 'now').mockReturnValue(now);
    vi.spyOn(clock, 'after').mockImplementation((ms) => new Date(now.getTime() + ms));
    vi.spyOn(clock, 'today').mockReturnValue(date);
    const soon = await createSlot({ date, startsAt: '12:00', endsAt: '13:00' });

    const listed = await slotOf(soon.slotId);
    expect(listed.bookingOpen).toBe(false);
    expect(listed.bookingClosesAt).toBe(`${date}T10:00`);

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

  it('answers 404 for a slot id above the largest integer of the database', async () => {
    const res = await request(app).get('/api/slots/3000000000/seating').query({ partySize: 1 });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'NotFoundError', message: 'Slot 3000000000 not found' });
  });
});

describe('POST /api/bookings', () => {
  const T = (tableNumber, seats) => ({ tableNumber, seats });
  const preview = async (slot, partySize) =>
    (await request(app).get(`/api/slots/${slot.slotId}/seating`).query({ partySize }).expect(200)).body.tables;

  it('books the tables of the preview for a logged-in hiker and says them', async () => {
    const slot = await createSlot({ seats: [4, 2] });
    const agent = await loggedIn('book.ok@example.com');

    const tables = await preview(slot, 2);
    const res = await agent.post('/api/bookings').send(bodyOf(slot, 2, tables));

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number), date: slot.date, slotId: slot.slotId, partySize: 2, tables: [T(2, 2)],
      requirements: [],
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

    const proposed = await preview(slot, 5);
    const res = await agent.post('/api/bookings').send(bodyOf(slot, 5, proposed));

    expect(res.status).toBe(201);
    expect(res.body.tables).toHaveLength(3);
    expect(res.body.tables).toEqual(proposed);
    expect(new Set(res.body.tables.map((table) => table.tableNumber)).size).toBe(3);
    expect(res.body.tables.reduce((sum, table) => sum + table.seats, 0)).toBe(5);
    expect(res.body.tables.every((table) => table.seats > 0 && table.seats <= 2)).toBe(true);
    expect((await slotOf(slot.slotId)).freeSeats).toBe(1);
  });

  it('accepts a large party when all its seats are available', async () => {
    const slot = await createSlot({ seats: [100] });
    const agent = await loggedIn('book.large-party@example.com');
    const tables = await preview(slot, 100);

    const res = await agent.post('/api/bookings').send(bodyOf(slot, 100, tables));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      slotId: slot.slotId,
      partySize: 100,
      tables: [T(1, 100)],
    });
    expect((await slotOf(slot.slotId)).freeSeats).toBe(0);
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

  it('answers 404 for a slot id above the largest integer of the database', async () => {
    const agent = await loggedIn('book.huge@example.com');

    const res = await agent.post('/api/bookings').send({ slotId: 3000000000, partySize: 1, tables: [T(1, 1)] });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'NotFoundError', message: 'Slot 3000000000 not found' });
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

describe('GET /api/bookings (MH-06)', () => {
  const inDb = (slot, hikerId) => bookingDao.createWithTableAssignments({
    hikerId,
    slotId: slot.slotId,
    partySize: 1,
    tableAssignments: [{ tableId: slot.tableIds[0], seatCount: 1 }],
  });

  it('returns an empty list when the hiker has no bookings', async () => {
    const owner = await loggedIn('my-bookings.empty@example.com');

    await owner.get('/api/bookings').expect(200, []);
  });

  it('lists only this hiker active bookings from hut-local today, including started meals, in date/time order', async () => {
    const now = clock.at('2090-11-08', '12:00', config.hutTimeZone);
    const sessionExpiry = new Date('2090-12-01T00:00:00Z');
    vi.spyOn(clock, 'now').mockReturnValue(now);
    vi.spyOn(clock, 'after').mockReturnValue(sessionExpiry);
    vi.spyOn(clock, 'today').mockReturnValue('2090-11-08');
    const owner = await loggedIn('my-bookings.owner@example.com');
    await loggedIn('my-bookings.other@example.com');
    const ownerRow = await get('SELECT id FROM app_user WHERE email = $1', ['my-bookings.owner@example.com']);
    const otherRow = await get('SELECT id FROM app_user WHERE email = $1', ['my-bookings.other@example.com']);

    const yesterday = await createSlot({ date: '2090-11-07', startsAt: '12:00', endsAt: '13:00', seats: [2] });
    const startedToday = await createSlot({ date: '2090-11-08', startsAt: '11:00', endsAt: '12:00', seats: [2] });
    const laterToday = await createSlot({ date: '2090-11-08', startsAt: '18:00', endsAt: '19:00', seats: [2] });
    const upcoming = await createSlot({ date: '2090-11-11', startsAt: '12:00', endsAt: '13:00', seats: [2] });
    const cancelled = await createSlot({ date: '2090-11-12', startsAt: '12:00', endsAt: '13:00', seats: [2] });
    const someoneElses = await createSlot({ date: '2090-11-13', startsAt: '12:00', endsAt: '13:00', seats: [2] });
    await inDb(yesterday, ownerRow.id);
    const startedBooking = await inDb(startedToday, ownerRow.id);
    const laterBooking = await inDb(laterToday, ownerRow.id);
    const upcomingBooking = await inDb(upcoming, ownerRow.id);
    const cancelledBooking = await inDb(cancelled, ownerRow.id);
    await inDb(someoneElses, otherRow.id);
    await run('UPDATE booking SET cancelled_at = $2 WHERE id = $1', [cancelledBooking.id, now]);

    const response = await owner.get('/api/bookings');

    expect(response.status).toBe(200);
    expect(response.body.map(({ id }) => id)).toEqual([
      startedBooking.id, laterBooking.id, upcomingBooking.id,
    ]);
    expect(response.body).toEqual([
      expect.objectContaining({
        id: startedBooking.id,
        date: '2090-11-08',
        startsAt: '11:00',
        canChange: false,
        changeableUntil: '2090-11-06T11:00',
      }),
      expect.objectContaining({
        id: laterBooking.id,
        date: '2090-11-08',
        startsAt: '18:00',
        canChange: false,
        changeableUntil: '2090-11-06T18:00',
      }),
      expect.objectContaining({
        id: upcomingBooking.id,
        date: '2090-11-11',
        startsAt: '12:00',
        canChange: true,
        changeableUntil: '2090-11-09T12:00',
      }),
    ]);
    expect((await request(app).get('/api/bookings')).status).toBe(401);
    const employee = await loggedIn('my-bookings.employee@example.com', 'EMPLOYEE');
    expect((await employee.get('/api/bookings')).status).toBe(403);
  });
});

describe('PATCH /api/bookings/:bookingId (MH-06)', () => {
  const T = (tableNumber, seats) => ({ tableNumber, seats });

  it('changes party size, reassigns seats around another booking, and persists the result', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const slot = await createSlot({ seats: [6, 6] });
    const owner = await loggedIn('change.reassign@example.com');
    const other = await loggedIn('change.other@example.com');
    const created = await owner.post('/api/bookings')
      .send({
        ...bodyOf(slot, 4, [T(1, 4)]),
        requirements: [{ diets: ['VEGAN'] }],
      })
      .expect(201);
    await other.post('/api/bookings')
      .send(bodyOf(slot, 2, [T(1, 2)]))
      .expect(201);

    const changed = await owner.patch(`/api/bookings/${created.body.id}`).send({ partySize: 6 });

    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({
      id: created.body.id,
      slotId: slot.slotId,
      partySize: 6,
      tables: [T(2, 6)],
      requirements: [{ diets: ['VEGAN'], allergies: [], hasAllergies: false }],
    });
    const afterReload = await owner.get('/api/bookings').expect(200);
    expect(afterReload.body.find(({ id }) => id === created.body.id)).toMatchObject({
      slotId: slot.slotId,
      partySize: 6,
      tables: [T(2, 6)],
      requirements: [{ diets: ['VEGAN'], allergies: [], hasAllergies: false }],
    });
    const assigned = await get(
      `SELECT hut_table.table_number AS "tableNumber", booking_table.seat_count AS seats
       FROM booking_table JOIN hut_table ON hut_table.id = booking_table.hut_table_id
       WHERE booking_table.booking_id = $1`,
      [created.body.id],
    );
    expect(assigned).toEqual({ tableNumber: 2, seats: 6 });
    expect((await slotOf(slot.slotId)).freeSeats).toBe(4);
  });

  it("counts the booking's own seats as free when the party grows on its current table", async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const slot = await createSlot({ seats: [4] });
    const owner = await loggedIn('change.reuse-own-seats@example.com');
    const created = await owner.post('/api/bookings')
      .send(bodyOf(slot, 2, [T(1, 2)]))
      .expect(201);
    expect((await slotOf(slot.slotId)).freeSeats).toBe(2);

    const changed = await owner.patch(`/api/bookings/${created.body.id}`).send({ partySize: 4 });

    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({
      id: created.body.id,
      partySize: 4,
      tables: [T(1, 4)],
    });
    expect((await slotOf(slot.slotId)).freeSeats).toBe(0);
    expect(await get(
      'SELECT seat_count AS seats FROM booking_table WHERE booking_id = $1 AND slot_id = $2',
      [created.body.id, slot.slotId],
    )).toEqual({ seats: 4 });
  });

  it('updates dietary needs without changing the slot, party size or assigned tables', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const slot = await createSlot({ seats: [4, 2] });
    const owner = await loggedIn('change.diet@example.com');
    const created = await owner.post('/api/bookings')
      .send({
        ...bodyOf(slot, 2, [T(2, 2)]),
        requirements: [{ diets: ['VEGAN'] }],
      })
      .expect(201);
    const originalTables = await get(
      'SELECT hut_table.table_number AS "tableNumber", booking_table.seat_count AS seats FROM booking_table JOIN hut_table ON hut_table.id = booking_table.hut_table_id WHERE booking_table.booking_id = $1',
      [created.body.id],
    );

    const newRequirements = [
      {
        diets: ['VEGAN'],
        otherDiet: 'Halal',
        allergies: ['GLUTEN'],
        otherAllergy: 'Sesame',
        otherRequests: 'No spicy food',
      },
      { diets: ['LACTOSE_FREE'], otherRequests: 'Small portion' },
    ];
    const changed = await owner.patch(`/api/bookings/${created.body.id}`)
      .send({ requirements: newRequirements });

    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({
      slotId: slot.slotId,
      partySize: 2,
      tables: [T(2, 2)],
      requirements: [
        {
          diets: ['VEGAN'],
          otherDiet: 'Halal',
          allergies: ['GLUTEN'],
          otherAllergy: 'Sesame',
          otherRequests: 'No spicy food',
          hasAllergies: true,
        },
        {
          diets: ['LACTOSE_FREE'],
          otherDiet: null,
          allergies: [],
          otherAllergy: null,
          otherRequests: 'Small portion',
          hasAllergies: false,
        },
      ],
    });
    expect(await get(
      'SELECT hut_table.table_number AS "tableNumber", booking_table.seat_count AS seats FROM booking_table JOIN hut_table ON hut_table.id = booking_table.hut_table_id WHERE booking_table.booking_id = $1',
      [created.body.id],
    )).toEqual(originalTables);
    expect((await owner.get('/api/bookings').expect(200)).body.find(({ id }) => id === created.body.id))
      .toMatchObject({
        requirements: [
          expect.objectContaining({ otherDiet: 'Halal', otherAllergy: 'Sesame', otherRequests: 'No spicy food' }),
          expect.objectContaining({ diets: ['LACTOSE_FREE'], otherRequests: 'Small portion' }),
        ],
      });

    const cleared = await owner.patch(`/api/bookings/${created.body.id}`).send({ requirements: [] });
    expect(cleared.status).toBe(200);
    expect(cleared.body.requirements).toEqual([]);
    expect(cleared.body.tables).toEqual([T(2, 2)]);
    expect((await owner.get('/api/bookings').expect(200)).body.find(({ id }) => id === created.body.id))
      .toMatchObject({ requirements: [], tables: [T(2, 2)] });
  });

  it('releases the seats no longer needed when the party shrinks', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const slot = await createSlot({ seats: [6] });
    const owner = await loggedIn('change.shrink@example.com');
    const created = await owner.post('/api/bookings')
      .send(bodyOf(slot, 4, [T(1, 4)]))
      .expect(201);
    expect((await slotOf(slot.slotId)).freeSeats).toBe(2);

    const changed = await owner.patch(`/api/bookings/${created.body.id}`).send({ partySize: 2 });

    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({ partySize: 2, tables: [T(1, 2)] });
    expect((await slotOf(slot.slotId)).freeSeats).toBe(4);
    expect((await owner.get('/api/bookings').expect(200)).body).toContainEqual(
      expect.objectContaining({ id: created.body.id, partySize: 2 }),
    );
  });

  it('refuses to shrink below the number of saved requirement lines without changing the booking', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const slot = await createSlot({ seats: [4] });
    const owner = await loggedIn('change.shrink-needs@example.com');
    const created = await owner.post('/api/bookings')
      .send({
        ...bodyOf(slot, 2, [T(1, 2)]),
        requirements: [{ diets: ['VEGAN'] }, { allergies: ['GLUTEN'] }],
      })
      .expect(201);

    const rejected = await owner.patch(`/api/bookings/${created.body.id}`).send({ partySize: 1 });

    expect(rejected.status).toBe(422);
    expect(rejected.body.message).toBe('There can be at most one requirement per person of the party');
    expect((await owner.get('/api/bookings').expect(200)).body).toContainEqual(
      expect.objectContaining({
        id: created.body.id,
        partySize: 2,
        tables: [T(1, 2)],
        requirements: [
          expect.objectContaining({ diets: ['VEGAN'] }),
          expect.objectContaining({ allergies: ['GLUTEN'] }),
        ],
      }),
    );
    expect((await slotOf(slot.slotId)).freeSeats).toBe(2);
  });

  it('rejects an increase without enough seats and leaves all original data unchanged', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const slot = await createSlot({ seats: [4] });
    const owner = await loggedIn('change.full.owner@example.com');
    const other = await loggedIn('change.full.other@example.com');
    const created = await owner.post('/api/bookings')
      .send(bodyOf(slot, 2, [T(1, 2)]))
      .expect(201);
    await other.post('/api/bookings')
      .send(bodyOf(slot, 2, [T(1, 2)]))
      .expect(201);

    const rejected = await owner.patch(`/api/bookings/${created.body.id}`).send({ partySize: 3 });

    expect(rejected.status).toBe(409);
    expect(rejected.body).toMatchObject({ error: 'ConflictError', code: 'NO_SEATS' });
    const afterReload = await owner.get('/api/bookings').expect(200);
    expect(afterReload.body.find(({ id }) => id === created.body.id)).toMatchObject({
      id: created.body.id,
      slotId: slot.slotId,
      partySize: 2,
      tables: [T(1, 2)],
      requirements: [],
    });
    expect((await slotOf(slot.slotId)).freeSeats).toBe(0);
  });

  it('rejects an increase when the original booking is inside the 48-hour window', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const date = '2090-11-20';
    const slot = await createSlot({ date, seats: [4] });
    const deadline = clock.at(date, '12:00', config.hutTimeZone).getTime() - (48 * 60 * 60 * 1000);
    const now = new Date(deadline + 1);
    vi.spyOn(clock, 'now').mockReturnValue(now);
    vi.spyOn(clock, 'after').mockImplementation((ms) => new Date(now.getTime() + ms));
    const owner = await loggedIn('change.original-closed@example.com');
    const created = await owner.post('/api/bookings')
      .send(bodyOf(slot, 2, [T(1, 2)]))
      .expect(201);

    const rejected = await owner.patch(`/api/bookings/${created.body.id}`).send({ partySize: 3 });

    expect(rejected.status).toBe(422);
    expect(rejected.body.message).toBe('Bookings can be changed until 48 hours before the meal');
    expect(await get('SELECT slot_id AS "slotId", party_size AS "partySize" FROM booking WHERE id = $1', [
      created.body.id,
    ])).toEqual({ slotId: slot.slotId, partySize: 2 });
    expect((await slotOf(slot.slotId)).freeSeats).toBe(2);
  });

  it('rejects moving to a destination inside its 48-hour window without changing the original booking', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const original = await createSlot({ date: '2090-11-20', startsAt: '12:00', endsAt: '13:00', seats: [4] });
    const destination = await createSlot({ date: '2090-11-19', startsAt: '18:00', endsAt: '19:00', seats: [4] });
    const now = clock.at(original.date, '12:00', config.hutTimeZone).getTime() - (48 * 60 * 60 * 1000);
    vi.spyOn(clock, 'now').mockReturnValue(new Date(now));
    vi.spyOn(clock, 'after').mockImplementation((ms) => new Date(now + ms));
    const owner = await loggedIn('change.destination-closed@example.com');
    const created = await owner.post('/api/bookings')
      .send(bodyOf(original, 2, [T(1, 2)]))
      .expect(201);

    const rejected = await owner.patch(`/api/bookings/${created.body.id}`)
      .send({ slotId: destination.slotId });

    expect(rejected.status).toBe(422);
    expect(rejected.body.message).toBe('Bookings can be changed until 48 hours before the meal');
    expect(await get('SELECT slot_id AS "slotId", party_size AS "partySize" FROM booking WHERE id = $1', [
      created.body.id,
    ])).toEqual({ slotId: original.slotId, partySize: 2 });
    expect((await slotOf(original.slotId)).freeSeats).toBe(2);
    expect((await slotOf(destination.slotId)).freeSeats).toBe(4);
  });

  it('moves a booking to the destination slot and frees its seats in the original slot', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const original = await createSlot({ seats: [4] });
    const destination = await createSlot({ seats: [4], startsAt: '18:00', endsAt: '19:00' });
    const owner = await loggedIn('change.move@example.com');
    const created = await owner.post('/api/bookings')
      .send({
        ...bodyOf(original, 2, [T(1, 2)]),
        requirements: [{ diets: ['VEGAN'] }],
      })
      .expect(201);

    const changed = await owner.patch(`/api/bookings/${created.body.id}`)
      .send({ slotId: destination.slotId });

    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({
      id: created.body.id,
      date: destination.date,
      slotId: destination.slotId,
      startsAt: '18:00',
      endsAt: '19:00',
      partySize: 2,
      tables: [T(1, 2)],
      requirements: [{ diets: ['VEGAN'], allergies: [], hasAllergies: false }],
    });
    expect((await slotOf(original.slotId)).freeSeats).toBe(4);
    expect((await slotOf(destination.slotId)).freeSeats).toBe(2);
    expect((await owner.get('/api/bookings').expect(200)).body).toContainEqual(
      expect.objectContaining({
        id: created.body.id, slotId: destination.slotId, startsAt: '18:00', requirements: created.body.requirements,
      }),
    );
  });

  it('allows an update at the exact 48-hour deadline', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const date = '2090-11-20';
    const slot = await createSlot({ date, seats: [4] });
    const deadline = clock.at(date, '12:00', config.hutTimeZone).getTime() - (48 * 60 * 60 * 1000);
    const now = new Date(deadline);
    vi.spyOn(clock, 'now').mockReturnValue(now);
    vi.spyOn(clock, 'after').mockImplementation((ms) => new Date(now.getTime() + ms));
    const owner = await loggedIn('change.boundary@example.com');
    const created = await owner.post('/api/bookings')
      .send(bodyOf(slot, 2, [T(1, 2)]))
      .expect(201);

    const changed = await owner.patch(`/api/bookings/${created.body.id}`)
      .send({ requirements: [{ diets: ['VEGAN'] }] });

    expect(changed.status).toBe(200);
    expect(changed.body.requirements).toMatchObject([{ diets: ['VEGAN'], allergies: [] }]);
  });

  it('requires an authenticated hiker and hides another hiker booking', async () => {
    const slot = await createSlot({ seats: [4] });
    const owner = await loggedIn('change.owner@example.com');
    const other = await loggedIn('change.not-owner@example.com');
    const created = await owner.post('/api/bookings')
      .send(bodyOf(slot, 2, [T(1, 2)]))
      .expect(201);

    expect((await request(app).patch(`/api/bookings/${created.body.id}`).send({ partySize: 3 })).status).toBe(401);
    const forbidden = await other.patch(`/api/bookings/${created.body.id}`).send({ partySize: 3 });
    expect(forbidden.status).toBe(404);
    const employee = await loggedIn('change.employee@example.com', 'EMPLOYEE');
    const warden = await loggedIn('change.warden@example.com', 'WARDEN');
    expect((await employee.patch(`/api/bookings/${created.body.id}`).send({ partySize: 3 })).status).toBe(403);
    expect((await warden.patch(`/api/bookings/${created.body.id}`).send({ partySize: 3 })).status).toBe(403);
    expect((await owner.get('/api/bookings').expect(200)).body).toContainEqual(
      expect.objectContaining({ id: created.body.id, partySize: 2 }),
    );
  });

  it('rejects malformed or invalid changes without modifying the booking', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const slot = await createSlot({ seats: [6] });
    const owner = await loggedIn('change.invalid@example.com');
    const created = await owner.post('/api/bookings')
      .send(bodyOf(slot, 2, [T(1, 2)]))
      .expect(201);
    const invalidBodies = [
      {},
      { tables: [T(1, 2)] },
      { partySize: 0 },
      { partySize: 2.5 },
      { requirements: [{ diets: ['VEGAN', 'VEGETARIAN'] }] },
      { requirements: [{ diets: ['UNKNOWN'] }] },
      { partySize: 1, requirements: [{ diets: ['VEGAN'] }, { allergies: ['GLUTEN'] }] },
    ];

    for (const body of invalidBodies) {
      expect((await owner.patch(`/api/bookings/${created.body.id}`).send(body)).status).toBe(400);
    }
    expect((await owner.patch('/api/bookings/not-an-id').send({ partySize: 3 })).status).toBe(400);
    expect(await get('SELECT slot_id AS "slotId", party_size AS "partySize" FROM booking WHERE id = $1', [
      created.body.id,
    ])).toEqual({ slotId: slot.slotId, partySize: 2 });
    expect((await slotOf(slot.slotId)).freeSeats).toBe(4);
  });

  it('rejects more requirement lines than the existing party when partySize is omitted', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const slot = await createSlot({ seats: [4] });
    const owner = await loggedIn('change.too-many-needs@example.com');
    const created = await owner.post('/api/bookings')
      .send(bodyOf(slot, 2, [T(1, 2)]))
      .expect(201);

    const rejected = await owner.patch(`/api/bookings/${created.body.id}`).send({
      requirements: [{ diets: ['VEGAN'] }, { allergies: ['GLUTEN'] }, { allergies: ['MILK'] }],
    });

    expect(rejected.status).toBe(422);
    expect(rejected.body.message).toBe('There can be at most one requirement per person of the party');
    expect((await owner.get('/api/bookings').expect(200)).body.find(({ id }) => id === created.body.id))
      .toMatchObject({ partySize: 2, requirements: [] });
  });

  it('returns 404 for a missing booking or a missing destination slot', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const original = await createSlot({ seats: [4] });
    const owner = await loggedIn('change.not-found@example.com');
    const created = await owner.post('/api/bookings')
      .send(bodyOf(original, 2, [T(1, 2)]))
      .expect(201);

    expect((await owner.patch('/api/bookings/999999999').send({ partySize: 1 })).status).toBe(404);
    const missingSlot = await owner.patch(`/api/bookings/${created.body.id}`).send({ slotId: 999999999 });
    expect(missingSlot.status).toBe(404);
    expect((await owner.get('/api/bookings').expect(200)).body).toContainEqual(
      expect.objectContaining({ id: created.body.id, slotId: original.slotId, partySize: 2 }),
    );
    expect((await slotOf(original.slotId)).freeSeats).toBe(2);
  });

  it('rejects moving to a slot without tables or one already booked by the hiker', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const original = await createSlot({ seats: [4] });
    const noTables = await createSlotWithoutTableSet();
    const occupied = await createSlot({ seats: [4] });
    const owner = await loggedIn('change.destination-failures@example.com');
    const created = await owner.post('/api/bookings')
      .send(bodyOf(original, 2, [T(1, 2)]))
      .expect(201);
    await owner.post('/api/bookings')
      .send(bodyOf(occupied, 1, [T(1, 1)]))
      .expect(201);

    const noTablesResponse = await owner.patch(`/api/bookings/${created.body.id}`)
      .send({ slotId: noTables.slotId });
    expect(noTablesResponse.status).toBe(422);
    const duplicateResponse = await owner.patch(`/api/bookings/${created.body.id}`)
      .send({ slotId: occupied.slotId });
    expect(duplicateResponse.status).toBe(422);
    expect(duplicateResponse.body.message).toBe('You already have a booking for this slot');
    expect((await owner.get('/api/bookings').expect(200)).body).toContainEqual(
      expect.objectContaining({ id: created.body.id, slotId: original.slotId, partySize: 2 }),
    );
    expect((await slotOf(original.slotId)).freeSeats).toBe(2);
  });


  it('refuses changes to a cancelled booking and preserves its data', async () => {
    const slot = await createSlot({ seats: [4] });
    const owner = await loggedIn('change.cancelled@example.com');

    const created = await owner.post('/api/bookings')
      .send(bodyOf(slot, 2, [{ tableNumber: 1, seats: 2 }]))
      .expect(201);

    await run(
      'UPDATE booking SET cancelled_at = now() WHERE id = $1',
      [created.body.id],
    );

    const rejected = await owner
      .patch(`/api/bookings/${created.body.id}`)
      .send({ partySize: 3 });

    expect(rejected.status).toBe(422);
    expect(rejected.body.message).toBe('This booking was cancelled');

    expect(await get(
      `SELECT
        cancelled_at IS NOT NULL AS cancelled,
        party_size AS "partySize"
      FROM booking
      WHERE id = $1`,
      [created.body.id],
    )).toEqual({
      cancelled: true,
      partySize: 2,
      });
    });
});


describe('updateBooking transaction (MH-06)', () => {
  it('rolls back the entire change if saving requirements fails', async () => {
    const slot = await createSlot({ seats: [4] });
    const email = 'update.booking.rollback@example.com';

    await users.insert({
      firstName: 'A',
      lastName: 'B',
      email,
      phone: null,
      role: 'HIKER',
      passwordHash: await hash(PASSWORD),
    });

    const hiker = await get('SELECT id FROM app_user WHERE email = $1', [email]);

    const originalRequirement = {
      diets: ['VEGAN'],
      otherDiet: null,
      allergies: [],
      otherAllergy: null,
      otherRequests: null,
    };

    const created = await bookingDao.createWithTableAssignments({
      hikerId: hiker.id,
      slotId: slot.slotId,
      partySize: 2,
      tableAssignments: [
        { tableId: slot.tableIds[0], seatCount: 2 },
      ],
      requirements: [originalRequirement],
    });

    const before = await bookingDao.findById(created.id);
    const freeBefore = await slots.findAvailableTablesBySlotId(slot.slotId);

    await expect(bookingDao.updateBooking({
      bookingId: created.id,
      expected: { slotId: slot.slotId, partySize: 2 },
      seats: {
        slotId: slot.slotId,
        partySize: 3,
        tableAssignments: [
          { tableId: slot.tableIds[0], seatCount: 3 },
        ],
      },
      requirements: [{
        diets: ['KETO'],
        otherDiet: null,
        allergies: [],
        otherAllergy: null,
        otherRequests: null,
      }],
    })).rejects.toThrow();

    expect(await bookingDao.findById(created.id)).toEqual(before);
    expect(await slots.findAvailableTablesBySlotId(slot.slotId))
      .toEqual(freeBefore);
  });
});
