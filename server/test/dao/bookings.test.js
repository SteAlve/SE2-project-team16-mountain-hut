import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { all, close, get, run } from '../../src/dao/db.js';
import * as bookings from '../../src/dao/bookings.js';
import * as slots from '../../src/dao/slots.js';
import {
  cleanBookingData,
  createHiker,
  createSlot,
  createSlotWithoutTableSet,
} from '../helpers/bookingFixtures.js';

let hiker;
let other;

const clean = async () => {
  await cleanBookingData();
  await run("DELETE FROM app_user WHERE email LIKE '%@example.com'");
};

beforeEach(async () => {
  await clean();
  hiker = await createHiker('dao.hiker@example.com');
  other = await createHiker('dao.other@example.com');
});
afterAll(async () => {
  await clean();
  await close();
});

const book = (slot, who, partySize, tableAssignments) =>
  bookings.createWithTableAssignments({ hikerId: who.id, slotId: slot.slotId, partySize, tableAssignments });

describe('slots dao', () => {
  it('finds a slot by id, with the date and the times as text', async () => {
    const slot = await createSlot({ date: '2090-03-05', startsAt: '12:30', endsAt: '13:30' });
    const expected = {
      slotId: slot.slotId,
      serviceDate: '2090-03-05',
      startsAt: '12:30:00',
      endsAt: '13:30:00',
      tableSetId: slot.tableSetId,
    };
    expect(await slots.findById(slot.slotId)).toEqual(expected);
    expect(await slots.findById(999999999)).toBeNull();
  });

  it('lists the free seats of the tables of a slot, with their numbers, and hides the full ones', async () => {
    const slot = await createSlot({ seats: [4, 2] });
    await book(slot, hiker, 2, [{ tableId: slot.tableIds[1], seatCount: 2 }]);

    expect(await slots.findAvailableTablesBySlotId(slot.slotId)).toEqual([
      { tableId: slot.tableIds[0], tableNumber: 1, seatCapacity: 4, freeSeats: 4 },
    ]);
  });

  it('lists every slot from a date on, full ones and ones without tables too, in order', async () => {
    const open = await createSlot({ date: '2090-04-10', startsAt: '12:00', endsAt: '13:00', seats: [4, 2] });
    const full = await createSlot({ date: '2090-04-10', startsAt: '13:00', endsAt: '14:00', seats: [2] });
    const later = await createSlot({ date: '2090-04-11', startsAt: '19:00', endsAt: '20:00', seats: [3] });
    const noTables = await createSlotWithoutTableSet('2090-04-10', '18:00', '19:00');
    const before = await createSlot({ date: '2090-04-09' });
    await book(open, hiker, 3, [{ tableId: open.tableIds[0], seatCount: 3 }]);
    await book(full, hiker, 2, [{ tableId: full.tableIds[0], seatCount: 2 }]);

    const ours = new Set([open, full, later, noTables, before].map((slot) => slot.slotId));
    const listed = (await slots.findFromDate('2090-04-10')).filter((slot) => ours.has(slot.slotId));

    expect(listed).toEqual([
      { slotId: open.slotId, date: '2090-04-10', startsAt: '12:00:00', endsAt: '13:00:00', freeSeats: 3 },
      { slotId: full.slotId, date: '2090-04-10', startsAt: '13:00:00', endsAt: '14:00:00', freeSeats: 0 },
      { slotId: noTables.slotId, date: '2090-04-10', startsAt: '18:00:00', endsAt: '19:00:00', freeSeats: 0 },
      { slotId: later.slotId, date: '2090-04-11', startsAt: '19:00:00', endsAt: '20:00:00', freeSeats: 3 },
    ].sort((a, b) => a.date.localeCompare(b.date) || a.startsAt.localeCompare(b.startsAt)));
  });

  it('gives back the seats of a cancelled booking', async () => {
    const slot = await createSlot({ seats: [4] });
    const booking = await book(slot, hiker, 4, [{ tableId: slot.tableIds[0], seatCount: 4 }]);
    expect(await slots.findAvailableTablesBySlotId(slot.slotId)).toEqual([]);

    await run('UPDATE booking SET cancelled_at = now() WHERE id = $1', [booking.id]);
    expect(await slots.findAvailableTablesBySlotId(slot.slotId)).toEqual([
      { tableId: slot.tableIds[0], tableNumber: 1, seatCapacity: 4, freeSeats: 4 },
    ]);
  });

  it('reads a DATE column as text, whatever the time zone of the server', async () => {
    expect(await get("SELECT DATE '2026-10-28' AS day")).toEqual({ day: '2026-10-28' });
  });
});

describe('bookings dao', () => {
  it.each([
    ['slotId', (slot, partySize, staleSlot) => ({ slotId: staleSlot, partySize })],
    ['partySize', (slot, partySize) => ({ slotId: slot.slotId, partySize: partySize + 1 })],
  ])('rejects an update with a stale expected %s and leaves persisted data unchanged', async (_field, staleExpected) => {
    const slot = await createSlot({ seats: [4] });
    const otherSlot = await createSlot({ seats: [4] });
    const requirements = [{
      diets: ['VEGETARIAN'],
      otherDiet: null,
      allergies: [],
      otherAllergy: null,
      otherRequests: null,
    }];
    const booking = await bookings.createWithTableAssignments({
      hikerId: hiker.id,
      slotId: slot.slotId,
      partySize: 2,
      tableAssignments: [{ tableId: slot.tableIds[0], seatCount: 2 }],
      requirements,
    });
    const beforeBooking = await bookings.findById(booking.id);
    const beforeAvailability = await Promise.all([
      slots.findAvailableTablesBySlotId(slot.slotId),
      slots.findAvailableTablesBySlotId(otherSlot.slotId),
    ]);
    const expected = staleExpected(slot, 2, otherSlot.slotId);

    await expect(bookings.updateBooking({ bookingId: booking.id, expected }))
      .rejects.toMatchObject({ code: 'BOOKING_CHANGED' });

    expect(await bookings.findById(booking.id)).toEqual(beforeBooking);
    expect(await Promise.all([
      slots.findAvailableTablesBySlotId(slot.slotId),
      slots.findAvailableTablesBySlotId(otherSlot.slotId),
    ])).toEqual(beforeAvailability);
  });

  it('rejects reducing party size below the existing requirement count without changing the booking', async () => {
    const slot = await createSlot({ seats: [4] });
    const requirements = [
      {
        diets: ['VEGETARIAN'],
        otherDiet: null,
        allergies: [],
        otherAllergy: null,
        otherRequests: null,
      },
      {
        diets: [],
        otherDiet: 'No dairy',
        allergies: [],
        otherAllergy: null,
        otherRequests: null,
      },
    ];
    const booking = await bookings.createWithTableAssignments({
      hikerId: hiker.id,
      slotId: slot.slotId,
      partySize: 3,
      tableAssignments: [{ tableId: slot.tableIds[0], seatCount: 3 }],
      requirements,
    });
    const beforeBooking = await bookings.findById(booking.id);
    const beforeAvailability = await slots.findAvailableTablesBySlotId(slot.slotId);

    await expect(bookings.updateBooking({
      bookingId: booking.id,
      expected: { slotId: slot.slotId, partySize: 3 },
      seats: {
        slotId: slot.slotId,
        partySize: 1,
        tableAssignments: [{ tableId: slot.tableIds[0], seatCount: 1 }],
      },
    })).rejects.toMatchObject({ code: 'TOO_MANY_REQUIREMENTS' });

    expect(await bookings.findById(booking.id)).toEqual(beforeBooking);
    expect(await slots.findAvailableTablesBySlotId(slot.slotId)).toEqual(beforeAvailability);
  });

  it("rejects moving a booking into the hiker's other booked slot without changing either booking", async () => {
    const originalSlot = await createSlot({ seats: [4] });
    const destinationSlot = await createSlot({ seats: [4] });
    const bookingA = await book(originalSlot, hiker, 2, [
      { tableId: originalSlot.tableIds[0], seatCount: 2 },
    ]);
    const bookingB = await book(destinationSlot, hiker, 2, [
      { tableId: destinationSlot.tableIds[0], seatCount: 2 },
    ]);
    const beforeBookings = await Promise.all([
      bookings.findById(bookingA.id),
      bookings.findById(bookingB.id),
    ]);
    const beforeAvailability = await Promise.all([
      slots.findAvailableTablesBySlotId(originalSlot.slotId),
      slots.findAvailableTablesBySlotId(destinationSlot.slotId),
    ]);

    await expect(bookings.updateBooking({
      bookingId: bookingA.id,
      expected: { slotId: originalSlot.slotId, partySize: 2 },
      seats: {
        slotId: destinationSlot.slotId,
        partySize: 2,
        tableAssignments: [{ tableId: destinationSlot.tableIds[0], seatCount: 2 }],
      },
    })).rejects.toMatchObject({ code: 'DUPLICATE_BOOKING' });

    expect(await Promise.all([
      bookings.findById(bookingA.id),
      bookings.findById(bookingB.id),
    ])).toEqual(beforeBookings);
    expect(await Promise.all([
      slots.findAvailableTablesBySlotId(originalSlot.slotId),
      slots.findAvailableTablesBySlotId(destinationSlot.slotId),
    ])).toEqual(beforeAvailability);
  });

  it('keeps bookings and free seats independent when slots reuse the same tables', async () => {
    const first = await createSlot({ date: '2090-08-20', seats: [4] });
    const secondRow = await get(
      `INSERT INTO slot (service_date, starts_at, ends_at, table_set_id)
       VALUES ('2090-08-20', '19:00', '20:00', $1) RETURNING id`,
      [first.tableSetId],
    );
    const second = { ...first, slotId: secondRow.id };
    await book(first, hiker, 4, [{ tableId: first.tableIds[0], seatCount: 4 }]);
    expect(await slots.findAvailableTablesBySlotId(first.slotId)).toEqual([]);
    expect(await bookings.hasActiveBooking(hiker.id, second.slotId)).toBe(false);
    expect(await slots.findAvailableTablesBySlotId(second.slotId)).toEqual([
      { tableId: first.tableIds[0], tableNumber: 1, seatCapacity: 4, freeSeats: 4 },
    ]);
    await book(second, hiker, 2, [{ tableId: first.tableIds[0], seatCount: 2 }]);
    expect(await bookings.hasActiveBooking(hiker.id, first.slotId)).toBe(true);
    expect(await bookings.hasActiveBooking(hiker.id, second.slotId)).toBe(true);
    const listed = await slots.findFromDate('2090-08-20');
    expect(listed.find((s) => s.slotId === first.slotId).freeSeats).toBe(0);
    expect(listed.find((s) => s.slotId === second.slotId).freeSeats).toBe(2);
  });

  it('stores the booking with its hiker and its seats', async () => {
    const slot = await createSlot({ seats: [4, 2] });
    const booking = await book(slot, hiker, 5, [
      { tableId: slot.tableIds[0], seatCount: 4 },
      { tableId: slot.tableIds[1], seatCount: 1 },
    ]);

    expect(booking).toMatchObject({ slotId: slot.slotId, partySize: 5 });
    expect(await get('SELECT hiker_id AS "hikerId", cancelled_at AS "cancelledAt" FROM booking WHERE id = $1', [booking.id]))
      .toEqual({ hikerId: hiker.id, cancelledAt: null });
    expect(await all('SELECT hut_table_id AS "tableId", seat_count AS "seatCount" FROM booking_table WHERE booking_id = $1 ORDER BY 1', [booking.id]))
      .toEqual([{ tableId: slot.tableIds[0], seatCount: 4 }, { tableId: slot.tableIds[1], seatCount: 1 }]);
  });

  it('lets two parties share a table', async () => {
    const slot = await createSlot({ seats: [4] });
    await book(slot, hiker, 2, [{ tableId: slot.tableIds[0], seatCount: 2 }]);
    await book(slot, other, 2, [{ tableId: slot.tableIds[0], seatCount: 2 }]);
    expect(await slots.findAvailableTablesBySlotId(slot.slotId)).toEqual([]);
  });

  it('refuses more seats than the table has free, with the code SEATS_UNAVAILABLE', async () => {
    const slot = await createSlot({ seats: [4] });
    await book(slot, hiker, 3, [{ tableId: slot.tableIds[0], seatCount: 3 }]);

    await expect(book(slot, other, 2, [{ tableId: slot.tableIds[0], seatCount: 2 }]))
      .rejects.toMatchObject({ code: 'SEATS_UNAVAILABLE' });
    expect(await get('SELECT count(*)::INT AS n FROM booking WHERE slot_id = $1', [slot.slotId])).toEqual({ n: 1 });
  });

  it('refuses a table of another set', async () => {
    const slot = await createSlot({ seats: [4] });
    const elsewhere = await createSlot({ seats: [4] });
    await expect(book(slot, hiker, 2, [{ tableId: elsewhere.tableIds[0], seatCount: 2 }]))
      .rejects.toMatchObject({ code: 'SEATS_UNAVAILABLE' });
  });

  it('allows one active booking per hiker and slot, with the code DUPLICATE_BOOKING', async () => {
    const slot = await createSlot({ seats: [6] });
    await book(slot, hiker, 2, [{ tableId: slot.tableIds[0], seatCount: 2 }]);

    expect(await bookings.hasActiveBooking(hiker.id, slot.slotId)).toBe(true);
    expect(await bookings.hasActiveBooking(other.id, slot.slotId)).toBe(false);
    await expect(book(slot, hiker, 1, [{ tableId: slot.tableIds[0], seatCount: 1 }]))
      .rejects.toMatchObject({ code: 'DUPLICATE_BOOKING' });
  });

  it('lets a hiker book again after cancelling', async () => {
    const slot = await createSlot({ seats: [6] });
    const first = await book(slot, hiker, 2, [{ tableId: slot.tableIds[0], seatCount: 2 }]);
    await run('UPDATE booking SET cancelled_at = now() WHERE id = $1', [first.id]);

    expect(await bookings.hasActiveBooking(hiker.id, slot.slotId)).toBe(false);
    await expect(book(slot, hiker, 2, [{ tableId: slot.tableIds[0], seatCount: 2 }])).resolves.toMatchObject({ partySize: 2 });
  });

  it('takes turns when two bookings fight for the last seats: one wins, one is refused', async () => {
    const slot = await createSlot({ seats: [2] });
    const results = await Promise.allSettled([
      book(slot, hiker, 2, [{ tableId: slot.tableIds[0], seatCount: 2 }]),
      book(slot, other, 2, [{ tableId: slot.tableIds[0], seatCount: 2 }]),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const refused = results.find((r) => r.status === 'rejected');
    expect(refused.reason.code).toBe('SEATS_UNAVAILABLE');
  });

  it('rejects concurrent duplicate bookings even when seats would fit both requests', async () => {
    const slot = await createSlot({ seats: [6] });
    const results = await Promise.allSettled([
      book(slot, hiker, 2, [{ tableId: slot.tableIds[0], seatCount: 2 }]),
      book(slot, hiker, 2, [{ tableId: slot.tableIds[0], seatCount: 2 }]),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected').reason.code).toBe('DUPLICATE_BOOKING');
    expect(await get('SELECT COUNT(*)::INT AS n FROM booking WHERE slot_id = $1', [slot.slotId]))
      .toEqual({ n: 1 });
    expect(await slots.findAvailableTablesBySlotId(slot.slotId)).toEqual([
      { tableId: slot.tableIds[0], tableNumber: 1, seatCapacity: 6, freeSeats: 4 },
    ]);
  });

  it('refuses a slot without table set and a slot that does not exist', async () => {
    const noSet = await createSlotWithoutTableSet();
    await expect(book(noSet, hiker, 1, [{ tableId: 1, seatCount: 1 }])).rejects.toThrow(RangeError);
    await expect(bookings.createWithTableAssignments({
      hikerId: hiker.id, slotId: 999999999, partySize: 1, tableAssignments: [{ tableId: 1, seatCount: 1 }],
    })).rejects.toThrow(RangeError);
  });

  it('refuses a call without a hiker or with seats that do not add up', async () => {
    const slot = await createSlot({ seats: [4] });
    const valid = {
      hikerId: hiker.id,
      slotId: slot.slotId,
      partySize: 1,
      tableAssignments: [{ tableId: slot.tableIds[0], seatCount: 1 }],
    };

    await expect(bookings.createWithTableAssignments({
      slotId: slot.slotId, partySize: 1, tableAssignments: [{ tableId: slot.tableIds[0], seatCount: 1 }],
    })).rejects.toThrow(TypeError);
    await expect(book(slot, hiker, 3, [{ tableId: slot.tableIds[0], seatCount: 2 }])).rejects.toThrow(RangeError);
    await expect(bookings.createWithTableAssignments({ ...valid, slotId: 0 })).rejects.toThrow(TypeError);
    await expect(bookings.createWithTableAssignments({ ...valid, partySize: 0 })).rejects.toThrow(TypeError);
    await expect(bookings.createWithTableAssignments({ ...valid, tableAssignments: [] })).rejects.toThrow(TypeError);
    await expect(bookings.createWithTableAssignments({
      ...valid,
      tableAssignments: [{ tableId: 0, seatCount: 1 }],
    })).rejects.toThrow(TypeError);
    await expect(bookings.createWithTableAssignments({
      ...valid,
      tableAssignments: [
        { tableId: slot.tableIds[0], seatCount: 1 },
        { tableId: slot.tableIds[0], seatCount: 1 },
      ],
      partySize: 2,
    })).rejects.toThrow(TypeError);
  });

  it('is protected by the database too: no second active booking even without the check', async () => {
    const slot = await createSlot({ seats: [6] });
    await book(slot, hiker, 1, [{ tableId: slot.tableIds[0], seatCount: 1 }]);
    await expect(run(
      'INSERT INTO booking (slot_id, table_set_id, hiker_id, party_size) VALUES ($1, $2, $3, 1)',
      [slot.slotId, slot.tableSetId, hiker.id],
    )).rejects.toMatchObject({ code: '23505' });
  });
});
