// MH-81 / MH-04: public availability through the real app, DTOs, use cases and PostgreSQL.
// Existing bookings are arranged with the real DAO; no HTTP, database or seating mocks.
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { clock } from '../../src/clock.js';
import { config } from '../../src/config.js';
import { createWithTableAssignments } from '../../src/dao/bookings.js';
import { all, close, run } from '../../src/dao/db.js';
import { cleanBookingData, createHiker, createSlot, createSlotWithoutTableSet } from '../helpers/bookingFixtures.js';

const HIKER_EMAIL = 'mh81.availability@example.com';
const clean = async () => {
  await cleanBookingData();
  await run('DELETE FROM app_user WHERE email = $1', [HIKER_EMAIL]);
};
beforeEach(clean);
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await clean();
  await close();
});

const check = (slot, partySize) => request(app)
  .get(`/api/slots/${slot.slotId}/seating`).query({ partySize });
const listedSlot = async (slot) => (await request(app).get('/api/slots').expect(200))
  .body.find(({ slotId }) => slotId === slot.slotId);

async function occupy(slot, seatCounts) {
  const hiker = await createHiker(HIKER_EMAIL);
  return createWithTableAssignments({
    hikerId: hiker.id, slotId: slot.slotId,
    partySize: seatCounts.reduce((sum, count) => sum + count, 0),
    tableAssignments: seatCounts.map((seatCount, index) => ({ tableId: slot.tableIds[index], seatCount })),
  });
}

// Compare stored rows as well as free seats: a check must not create a booking or reserve seats.
async function storedState(slot) {
  return {
    bookings: await all('SELECT * FROM booking WHERE slot_id = $1 ORDER BY id', [slot.slotId]),
    assignments: await all('SELECT * FROM booking_table WHERE slot_id = $1 ORDER BY booking_id, hut_table_id', [slot.slotId]),
    tables: await all('SELECT * FROM hut_table WHERE table_set_id = $1 ORDER BY id', [slot.tableSetId]),
  };
}

describe('MH-04 public availability', () => {
  it('accepts six people at three tables of two without login (PO example)', async () => {
    const slot = await createSlot({ seats: [2, 2, 2] });
    expect((await listedSlot(slot)).freeSeats).toBe(6);

    const response = await check(slot, 6).expect(200);

    expect(response.body).toEqual({
      slotId: slot.slotId, partySize: 6,
      tables: [{ tableNumber: 1, seats: 2 }, { tableNumber: 2, seats: 2 }, { tableNumber: 3, seats: 2 }],
    });
  });

  it('uses remaining seats, returning the actual 2 + 3 + 1 split without changing stored data', async () => {
    const slot = await createSlot({ seats: [4, 4, 2] });
    await occupy(slot, [2, 1, 1]);
    const before = await storedState(slot);
    expect(before.bookings).toHaveLength(1);
    expect(before.assignments).toHaveLength(3);
    expect((await listedSlot(slot)).freeSeats).toBe(6);

    const response = await check(slot, 6).expect(200);

    expect(response.body).toEqual({
      slotId: slot.slotId, partySize: 6,
      tables: [{ tableNumber: 1, seats: 2 }, { tableNumber: 2, seats: 3 }, { tableNumber: 3, seats: 1 }],
    });
    expect((await check(slot, 6).expect(200)).body).toEqual(response.body);
    expect(await storedState(slot)).toEqual(before);
    expect((await listedSlot(slot)).freeSeats).toBe(6);
  });

  it('reports insufficient seats without alternatives, and allows checking another slot', async () => {
    const full = await createSlot({ date: '2090-06-20', startsAt: '12:00', endsAt: '13:00', seats: [2] });
    const other = await createSlot({ date: '2090-06-20', startsAt: '19:00', endsAt: '20:00', seats: [4] });
    await occupy(full, [2]);
    const before = await storedState(full);

    expect((await listedSlot(full)).freeSeats).toBe(0);
    const response = await check(full, 1).expect(409);
    expect(response.body).toEqual({ error: 'ConflictError', message: 'Not enough free seats', code: 'NO_SEATS' });
    expect((await check(other, 1).expect(200)).body).toEqual({
      slotId: other.slotId, partySize: 1, tables: [{ tableNumber: 1, seats: 1 }],
    });
    expect(await storedState(full)).toEqual(before);
    expect((await storedState(other)).bookings).toEqual([]);
  });

  it('does not use capacity from another slot when the requested party is too large', async () => {
    const slot = await createSlot({ seats: [2, 2] });
    await createSlot({ seats: [20] });

    const response = await check(slot, 5).expect(409);

    expect(response.body).toEqual({ error: 'ConflictError', message: 'Not enough free seats', code: 'NO_SEATS' });
    expect((await listedSlot(slot)).freeSeats).toBe(4);
    expect((await storedState(slot)).bookings).toEqual([]);
  });

  it('reports zero seats and unavailability for a slot without an assigned table set', async () => {
    const slot = await createSlotWithoutTableSet();
    expect((await listedSlot(slot)).freeSeats).toBe(0);

    const response = await check(slot, 1).expect(422);

    expect(response.body).toEqual({
      error: 'UnprocessableError', message: `Slot ${slot.slotId} is not available for booking`,
    });
  });

  it('refreshes availability after a committed booking consumes the seats', async () => {
    const slot = await createSlot({ seats: [2] });
    await check(slot, 2).expect(200);

    await occupy(slot, [2]);

    expect((await listedSlot(slot)).freeSeats).toBe(0);
    expect((await check(slot, 2).expect(409)).body.code).toBe('NO_SEATS');
  });

  it.each([undefined, '-1', '1.5', 'abc', '9007199254740992'])('rejects invalid party size %s without creating bookings', async (partySize) => {
    const slot = await createSlot();
    const query = partySize === undefined ? {} : { partySize };

    const response = await request(app).get(`/api/slots/${slot.slotId}/seating`).query(query).expect(400);

    expect(response.body).toEqual({ error: 'ValidationError', message: 'partySize must be a positive integer' });
    expect((await storedState(slot)).bookings).toEqual([]);
  });
});

// Shared MH-01 booking policy, also used by the availability endpoint; not a new MH-04 PO rule.
describe('availability and the existing two-hour deadline', () => {
  it.each([[0, 200], [1000, 422]])('checks the boundary at closing plus %i ms', async (offset, status) => {
    const slot = await createSlot({ date: '2090-06-21', startsAt: '12:00', endsAt: '13:00', seats: [2] });
    const closing = clock.at(slot.date, '10:00', config.hutTimeZone);
    vi.spyOn(clock, 'now').mockReturnValue(new Date(closing.getTime() + offset));
    vi.spyOn(clock, 'today').mockReturnValue(slot.date);

    const response = await check(slot, 1).expect(status);

    expect((await listedSlot(slot)).bookingOpen).toBe(status === 200);
    if (status === 422) {
      expect(response.body).toEqual({ error: 'UnprocessableError', message: 'Bookings close two hours before the meal' });
    }
    expect((await storedState(slot)).bookings).toEqual([]);
  });
});
