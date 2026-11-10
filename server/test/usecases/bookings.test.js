import { describe, expect, it } from 'vitest';
import { makeCheckSlotOpen } from '../../src/usecases/checkSlotOpen.js';
import { makeCreateBooking } from '../../src/usecases/createBooking.js';
import { makeListSlots } from '../../src/usecases/listSlots.js';
import { makePreviewSeating } from '../../src/usecases/previewSeating.js';
import { clock as realClock } from '../../src/clock.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
} from '../../src/domain/errors.js';

const ZONE = 'Europe/Rome';
const CHANGED = 'The chosen tables are no longer the ones proposed for this party';
const DATE = '2026-10-28';
// 12:00 in Rome on that day is 11:00 UTC, so booking closes at 09:00 UTC
const AT_CLOSING = new Date('2026-10-28T09:00:00Z');
const hiker = { id: 7, role: 'HIKER' };
const slotRow = { slotId: 12, serviceDate: DATE, startsAt: '12:00:00', endsAt: '13:00:00', tableSetId: 1 };

// the real clock, with a fixed "now"
const clockAt = (now) => ({
  now: () => now,
  at: realClock.at,
  today: (zone) => realClock.localDateTime(now.getTime(), zone).slice(0, 10),
  localDateTime: realClock.localDateTime,
});

// tables: tableId i+1 has tableNumber (i+1)*10, so that ids and numbers are never mixed up
const tables = (...free) => free.map((freeSeats, i) => ({
  tableId: i + 1, tableNumber: (i + 1) * 10, freeSeats,
}));

function setup({ now = new Date('2026-10-27T10:00:00Z'), slot = slotRow, layout = [], create } = {}) {
  const calls = [];
  const lookups = { slot: [], tables: [], duplicate: [] };
  const layoutNow = typeof layout === 'function' ? layout : () => layout;
  let duplicate = false;
  const slots = {
    findById: async (slotId) => {
      lookups.slot.push(slotId);
      return slot;
    },
    findAvailableTablesBySlotId: async (slotId) => {
      lookups.tables.push(slotId);
      return layoutNow(calls.length);
    },
  };
  const bookings = {
    hasActiveBooking: async (hikerId, slotId) => {
      lookups.duplicate.push({ hikerId, slotId });
      return duplicate;
    },
    createWithTableAssignments: async (input) => {
      calls.push(input);
      if (create) return create(input, calls.length);
      return { id: 45, slotId: input.slotId, partySize: input.partySize, requirements: input.requirements };
    },
  };
  const checkSlotOpen = makeCheckSlotOpen({ clock: clockAt(now), hutTimeZone: ZONE });
  return {
    calls,
    lookups,
    setDuplicate: (value) => { duplicate = value; },
    book: (input = {}) => makeCreateBooking({ slots, bookings, checkSlotOpen })(
      { user: hiker, slotId: 12, partySize: 2, tables: [{ tableNumber: 10, seats: 2 }], ...input },
    ),
    preview: (input = {}) => makePreviewSeating({ slots, checkSlotOpen })({ slotId: 12, partySize: 2, ...input }),
  };
}

describe('createBooking', () => {
  const at = (tableNumber, seats) => ({ tableNumber, seats });

  it('books exactly the tables it is given and answers with them', async () => {
    const t = setup({ layout: tables(4, 6) });
    await expect(t.book({ partySize: 5, tables: [at(20, 5)] })).resolves.toEqual({
      id: 45, date: DATE, slotId: 12, partySize: 5, tables: [at(20, 5)], requirements: [],
    });
    expect(t.calls).toEqual([{
      hikerId: 7, slotId: 12, partySize: 5, tableAssignments: [{ tableId: 2, seatCount: 5 }], requirements: [],
    }]);
  });

  it('answers 409 for tables that are free but not the ones the preview would give', async () => {
    const t = setup({ layout: tables(6, 3, 2) }); // the preview for 3 is table 20
    await expect(t.book({ partySize: 3, tables: [at(10, 3)] }))
      .rejects.toMatchObject({ name: 'ConflictError', code: 'TABLES_CHANGED', message: CHANGED });
    expect(t.calls).toHaveLength(0);
  });

  it('answers 409 NO_SEATS, not TABLES_CHANGED, when the party does not fit at all any more', async () => {
    const t = setup({ layout: tables(2, 1) });
    await expect(t.book({ partySize: 4, tables: [at(10, 2), at(20, 2)] }))
      .rejects.toMatchObject({ name: 'ConflictError', code: 'NO_SEATS', message: 'Not enough free seats' });
    expect(t.calls).toHaveLength(0);
  });

  it('answers 409 for a party split differently from the preview', async () => {
    const t = setup({ layout: tables(3, 3, 1) });
    const proposed = (await t.preview({ partySize: 5 })).tables;
    // Both 3+2 and 2+3 fit, but confirmation must preserve the actual preview.
    const different = proposed.map((table) => ({ ...table, seats: 5 - table.seats }));
    await expect(t.book({ partySize: 5, tables: different })).rejects.toBeInstanceOf(ConflictError);
    await expect(t.book({ partySize: 5, tables: [at(10, 2), at(30, 1), at(20, 2)] })).rejects.toBeInstanceOf(ConflictError);
    expect(t.calls).toHaveLength(0);
  });

  it('rejects a request that does not match the current seating proposal', async () => {
    const t = setup({ layout: tables(2, 4) });
    await expect(t.book({ partySize: 2, tables: [at(20, 2)] })).rejects.toBeInstanceOf(ConflictError);
    await expect(t.book({ partySize: 2, tables: [at(10, 2)] })).resolves.toMatchObject({ id: 45 });
  });

  it('accepts the tables in any order, books them by id and says them by number', async () => {
    const layout = tables(3, 3, 1);
    const t = setup({ layout });
    const proposed = (await t.preview({ partySize: 5 })).tables;
    const booking = await t.book({ partySize: 5, tables: [...proposed].reverse() });
    const idsByNumber = new Map(layout.map((table) => [table.tableNumber, table.tableId]));
    expect(t.calls[0].tableAssignments).toEqual(proposed.map(({ tableNumber, seats }) => ({
      tableId: idsByNumber.get(tableNumber), seatCount: seats,
    })));
    expect(booking.tables).toEqual(proposed);
  });

  it('answers 403 when the user is not a hiker', async () => {
    const t = setup({ layout: tables(4) });
    await expect(t.book({ user: { id: 1, role: 'EMPLOYEE' } })).rejects.toThrow(
      new ForbiddenError('Only hikers can create bookings'),
    );
    await expect(t.book({ user: { id: 1, role: 'WARDEN' } })).rejects.toBeInstanceOf(ForbiddenError);
    expect(t.lookups).toEqual({ slot: [], tables: [], duplicate: [] });
  });

  it('answers 404 when the slot does not exist, like the preview', async () => {
    const t = setup({ slot: null });
    await expect(t.book()).rejects.toThrow(new NotFoundError('Slot 12 not found'));
    expect(t.lookups).toEqual({ slot: [12], tables: [], duplicate: [] });
  });

  it('answers 422 when the slot has no table set', async () => {
    const t = setup({ slot: { ...slotRow, tableSetId: null }, layout: tables(4) });
    await expect(t.book()).rejects.toThrow(new UnprocessableError('Slot 12 is not available for booking'));
    expect(t.lookups).toEqual({ slot: [12], tables: [], duplicate: [] });
  });

  it('accepts a booking exactly 2 hours before the meal (in the time zone of the hut)', async () => {
    const t = setup({ now: AT_CLOSING, layout: tables(4) });
    await expect(t.book()).resolves.toMatchObject({ id: 45 });
  });

  it('refuses a booking one second later', async () => {
    const t = setup({ now: new Date(AT_CLOSING.getTime() + 1000), layout: tables(4) });
    await expect(t.book()).rejects.toThrow(new UnprocessableError('Bookings close two hours before the meal'));
    expect(t.calls).toHaveLength(0);
  });

  it('answers 422 when the hiker already has a booking for the slot', async () => {
    const t = setup({ layout: tables(4) });
    t.setDuplicate(true);
    await expect(t.book()).rejects.toThrow(new UnprocessableError('You already have a booking for this slot'));
    expect(t.lookups.tables).toHaveLength(0);
    expect(t.calls).toHaveLength(0);
  });

  it('answers 409 when a table has fewer free seats than asked', async () => {
    const t = setup({ layout: tables(2, 1) });
    await expect(t.book({ partySize: 3, tables: [at(10, 3)] }))
      .rejects.toMatchObject({ name: 'ConflictError', code: 'TABLES_CHANGED', message: CHANGED });
    expect(t.calls).toHaveLength(0);
  });

  it('answers 409 for a full table or a table that is not in the slot', async () => {
    const t = setup({ layout: tables(0, 4) }); // table 10 is full: it is not listed as free
    await expect(t.book({ tables: [at(10, 2)] })).rejects.toBeInstanceOf(ConflictError);
    await expect(t.book({ tables: [at(99, 2)] })).rejects.toBeInstanceOf(ConflictError);
    expect(t.calls).toHaveLength(0);
  });

  it('answers 409 when all the tables are asked but one of them is not free enough', async () => {
    const t = setup({ layout: tables(3, 1) });
    await expect(t.book({ partySize: 4, tables: [at(10, 2), at(20, 2)] })).rejects.toBeInstanceOf(ConflictError);
    expect(t.calls).toHaveLength(0);
  });

  it('seats a party that needs every free seat', async () => {
    const t = setup({ layout: tables(2, 1) });
    await expect(t.book({ partySize: 3, tables: [at(10, 2), at(20, 1)] })).resolves.toMatchObject({ partySize: 3 });
  });

  it('answers 409, without trying again, when the dao finds the seats taken in between', async () => {
    const t = setup({
      layout: tables(4),
      create: () => { throw Object.assign(new RangeError('taken'), { code: 'SEATS_UNAVAILABLE' }); },
    });
    await expect(t.book()).rejects.toMatchObject({ name: 'ConflictError', code: 'TABLES_CHANGED', message: CHANGED });
    expect(t.calls).toHaveLength(1);
  });

  it('answers 422 when the dao finds a duplicate booking made in the meantime', async () => {
    const t = setup({
      layout: tables(4),
      create: () => { throw Object.assign(new RangeError('dup'), { code: 'DUPLICATE_BOOKING' }); },
    });
    await expect(t.book()).rejects.toBeInstanceOf(UnprocessableError);
  });

  it('does not hide an unexpected error', async () => {
    const failure = new Error('database down');
    const t = setup({ layout: tables(4), create: () => { throw failure; } });
    await expect(t.book()).rejects.toBe(failure);
  });
});

describe('previewSeating', () => {
  it('says where the party would sit and books nothing', async () => {
    const t = setup({ layout: tables(4, 2) });
    await expect(t.preview({ partySize: 6 })).resolves.toEqual({
      slotId: 12,
      partySize: 6,
      tables: [{ tableNumber: 10, seats: 4 }, { tableNumber: 20, seats: 2 }],
    });
    expect(t.calls).toHaveLength(0);
  });

  it('chooses like the booking does', async () => {
    const t = setup({ layout: tables(6, 3, 2) });
    expect((await t.preview({ partySize: 3 })).tables).toEqual([{ tableNumber: 20, seats: 3 }]);
  });

  it('answers 404 for an unknown slot, 409 NO_SEATS when it does not fit, 422 when it is closed', async () => {
    const unknown = setup({ slot: null });
    await expect(unknown.preview()).rejects.toThrow(new NotFoundError('Slot 12 not found'));
    expect(unknown.lookups.tables).toHaveLength(0);

    await expect(setup({ layout: tables(2) }).preview({ partySize: 3 })).rejects.toMatchObject({ name: 'ConflictError', code: 'NO_SEATS' });
    const closed = setup({ now: new Date(AT_CLOSING.getTime() + 1), layout: tables(4) });
    await expect(closed.preview())
      .rejects.toBeInstanceOf(UnprocessableError);
    expect(closed.lookups.tables).toHaveLength(0);

    const noSet = setup({ slot: { ...slotRow, tableSetId: null } });
    await expect(noSet.preview())
      .rejects.toBeInstanceOf(UnprocessableError);
    expect(noSet.lookups.tables).toHaveLength(0);
  });
});

describe('listSlots', () => {
  const rows = [
    { slotId: 1, date: DATE, startsAt: '11:00:00', endsAt: '12:00:00', freeSeats: 4 },
    { slotId: 2, date: DATE, startsAt: '12:00:00', endsAt: '13:00:00', freeSeats: 0 },
    { slotId: 3, date: '2026-10-30', startsAt: '19:00:00', endsAt: '20:00:00', freeSeats: 2 },
  ];
  const list = (now) => {
    const asked = [];
    const slots = { findFromDate: async (date) => { asked.push(date); return rows; } };
    return makeListSlots({ slots, clock: clockAt(now), hutTimeZone: ZONE })().then((result) => ({ result, asked }));
  };

  it('asks for the slots from today in the time zone of the hut', async () => {
    // 23:30 UTC on the 27th is already the 28th in Rome
    expect((await list(new Date('2026-10-27T23:30:00Z'))).asked).toEqual([DATE]);
    expect((await list(new Date('2026-10-27T10:00:00Z'))).asked).toEqual(['2026-10-27']);
  });

  it('lists every slot, full ones too, with when booking closes and if it is still open', async () => {
    const { result } = await list(AT_CLOSING); // 10:00 in Rome
    expect(result).toEqual([
      { ...rows[0], bookingOpen: false, bookingClosesAt: '2026-10-28T09:00' },
      { ...rows[1], bookingOpen: true, bookingClosesAt: '2026-10-28T10:00' },
      { ...rows[2], bookingOpen: true, bookingClosesAt: '2026-10-30T17:00' },
    ]);
  });

  it('closes a slot at the same wall-clock time all year (summer time)', async () => {
    const slots = { findFromDate: async () => [{ slotId: 9, date: '2026-07-15', startsAt: '12:00:00', endsAt: '13:00:00', freeSeats: 1 }] };
    const [slot] = await makeListSlots({ slots, clock: clockAt(new Date('2026-07-14T00:00:00Z')), hutTimeZone: ZONE })();
    expect(slot.bookingClosesAt).toBe('2026-07-15T10:00');
  });

  it('returns an empty list when no slots are available', async () => {
    const slots = { findFromDate: async () => [] };
    const result = await makeListSlots({
      slots,
      clock: clockAt(new Date('2026-10-28T09:00:00Z')),
      hutTimeZone: ZONE,
    })();

    expect(result).toEqual([]);
  });
});
