import { describe, expect, it } from 'vitest';
import {
  parseCreateBooking,
  parseSeatingRequest,
  toBookingDto,
  toSeatingDto,
  toSlotDto,
} from '../../src/dto/bookings.js';
import { ValidationError } from '../../src/domain/errors.js';

describe('parseCreateBooking', () => {
  const valid = {
    slotId: 12,
    partySize: 5,
    tables: [{ tableNumber: 1, seats: 3 }, { tableNumber: 2, seats: 2 }],
  };

  it('accepts the slot, the party size and the tables', () => {
    expect(parseCreateBooking(valid)).toEqual(valid);
  });

  it.each([
    ['a body that is not an object', null, 'Request body must be a JSON object'],
    ['an unknown field', { ...valid, hikerId: 3 }, 'Unknown field: hikerId'],
    ['a date: the slot already says it', { ...valid, date: '2026-10-28' }, 'Unknown field: date'],
    ['a missing slotId', { ...valid, slotId: undefined }, 'slotId must be a positive integer'],
    ['a slotId as text', { ...valid, slotId: '12' }, 'slotId must be a positive integer'],
    ['a zero partySize', { ...valid, partySize: 0 }, 'partySize must be a positive integer'],
    ['a negative partySize', { ...valid, partySize: -2 }, 'partySize must be a positive integer'],
    ['a decimal partySize', { ...valid, partySize: 2.5 }, 'partySize must be a positive integer'],
    ['missing tables', { ...valid, tables: undefined }, 'tables must be a non-empty array'],
    ['an empty list of tables', { ...valid, tables: [] }, 'tables must be a non-empty array'],
    ['tables that are not a list', { ...valid, tables: { tableNumber: 1, seats: 5 } }, 'tables must be a non-empty array'],
    ['a table that is not an object', { ...valid, tables: [7] }, 'Each table must be an object'],
    ['an unknown field in a table', { ...valid, tables: [{ tableNumber: 1, seats: 5, tableId: 9 }] }, 'Unknown field in tables: tableId'],
    ['a wrong table number', { ...valid, tables: [{ tableNumber: 0, seats: 5 }] }, 'tableNumber must be a positive integer'],
    ['a table number as text', { ...valid, tables: [{ tableNumber: '1', seats: 5 }] }, 'tableNumber must be a positive integer'],
    ['zero seats at a table', { ...valid, tables: [{ tableNumber: 1, seats: 0 }, { tableNumber: 2, seats: 5 }] }, 'seats must be a positive integer'],
    ['the same table twice', { ...valid, tables: [{ tableNumber: 1, seats: 3 }, { tableNumber: 1, seats: 2 }] }, 'A table can appear only once in tables'],
    ['seats that do not add up to the party', { ...valid, partySize: 6 }, 'The seats of the tables must add up to partySize'],
  ])('rejects %s', (_name, body, message) => {
    expect(() => parseCreateBooking(body)).toThrow(new ValidationError(message));
  });
});

describe('parseSeatingRequest', () => {
  it('reads the slot of the path and the party size of the query as numbers', () => {
    expect(parseSeatingRequest({ slotId: '12' }, { partySize: '6' })).toEqual({ slotId: 12, partySize: 6 });
  });

  it.each([
    ['slotId', { slotId: 'abc' }, { partySize: '2' }],
    ['slotId', { slotId: '0' }, { partySize: '2' }],
    ['slotId', { slotId: '1.5' }, { partySize: '2' }],
    ['partySize', { slotId: '1' }, {}],
    ['partySize', { slotId: '1' }, { partySize: '0' }],
    ['partySize', { slotId: '1' }, { partySize: '-1' }],
    ['partySize', { slotId: '1' }, { partySize: 'two' }],
    ['partySize', { slotId: '1' }, { partySize: ['2', '3'] }],
  ])('rejects a wrong %s', (field, params, query) => {
    expect(() => parseSeatingRequest(params, query))
      .toThrow(new ValidationError(`${field} must be a positive integer`));
  });
});

describe('output', () => {
  it('writes the times of a slot as HH:MM and keeps the closing time as it is', () => {
    expect(toSlotDto({
      slotId: 1, date: '2026-10-28', startsAt: '12:00:00', endsAt: '13:30:00', freeSeats: 0,
      bookingOpen: false, bookingClosesAt: '2026-10-28T10:00', tableSetId: 9,
    })).toEqual({
      slotId: 1, date: '2026-10-28', startsAt: '12:00', endsAt: '13:30', freeSeats: 0,
      bookingOpen: false, bookingClosesAt: '2026-10-28T10:00',
    });
  });

  it('shapes the seating and the booking with the table numbers and seats only', () => {
    const tables = [{ tableNumber: 3, seats: 4, tableId: 99 }, { tableNumber: 5, seats: 2 }];
    expect(toSeatingDto({ slotId: 1, partySize: 6, tables, extra: 1 }))
      .toEqual({ slotId: 1, partySize: 6, tables: [{ tableNumber: 3, seats: 4 }, { tableNumber: 5, seats: 2 }] });
    expect(toBookingDto({ id: 5, date: '2026-10-28', slotId: 1, partySize: 6, tables, hikerId: 3 }))
      .toEqual({
        id: 5, date: '2026-10-28', slotId: 1, partySize: 6,
        tables: [{ tableNumber: 3, seats: 4 }, { tableNumber: 5, seats: 2 }],
      });
  });
});
