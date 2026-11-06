import { describe, expect, it } from 'vitest';
import {
  parseAssignTableSet,
  parseCreateSlot,
  parseCreateTableSet,
  parseListStaffSlots,
  toStaffSlotDto,
  toTableSetDto,
} from '../../src/dto/staff.js';
import { ValidationError } from '../../src/domain/errors.js';

const fails = (fn, message) => expect(fn).toThrow(new ValidationError(message));

describe('parseCreateTableSet', () => {
  const valid = {
    name: 'Lunch, main room',
    tables: [{ tableNumber: 1, capacity: 4 }, { tableNumber: 2, capacity: 6 }],
  };

  it('accepts a name and tables, and trims the name', () => {
    expect(parseCreateTableSet(valid)).toEqual(valid);
    expect(parseCreateTableSet({ ...valid, name: '  Dinner ' }).name).toBe('Dinner');
  });

  it.each([
    ['a body that is not an object', null, 'Request body must be a JSON object'],
    ['an unknown field', { ...valid, id: 1 }, 'Unknown field: id'],
    ['a missing name', { ...valid, name: undefined }, 'name is required'],
    ['a blank name', { ...valid, name: '   ' }, 'name is required'],
    ['no tables', { ...valid, tables: undefined }, 'tables must be a non-empty array'],
    ['an empty list of tables', { ...valid, tables: [] }, 'tables must be a non-empty array'],
    ['a table that is not an object', { ...valid, tables: [3] }, 'Each table must be an object'],
    ['an unknown field in a table', { ...valid, tables: [{ tableNumber: 1, capacity: 4, seats: 4 }] }, 'Unknown field in tables: seats'],
    ['a table number that is not positive', { ...valid, tables: [{ tableNumber: 0, capacity: 4 }] }, 'tableNumber must be a positive integer'],
    ['a capacity as text', { ...valid, tables: [{ tableNumber: 1, capacity: '4' }] }, 'capacity must be a positive integer'],
    ['a capacity of 0', { ...valid, tables: [{ tableNumber: 1, capacity: 0 }] }, 'capacity must be a positive integer'],
    ['two tables with the same number', { ...valid, tables: [{ tableNumber: 1, capacity: 4 }, { tableNumber: 1, capacity: 2 }] }, 'tableNumber values must be unique'],
  ])('rejects %s', (_name, body, message) => fails(() => parseCreateTableSet(body), message));
});

describe('parseCreateSlot', () => {
  const valid = { date: '2026-10-28', startsAt: '12:00', endsAt: '13:00', tableSetId: 3 };

  it('accepts a date, two times and an optional table set', () => {
    expect(parseCreateSlot(valid)).toEqual(valid);
    expect(parseCreateSlot({ ...valid, tableSetId: undefined })).toEqual({ date: '2026-10-28', startsAt: '12:00', endsAt: '13:00' });
    expect(parseCreateSlot({ ...valid, tableSetId: null })).not.toHaveProperty('tableSetId');
  });

  it('accepts any start and duration, even across the whole day', () => {
    expect(parseCreateSlot({ ...valid, startsAt: '00:00', endsAt: '23:59' })).toMatchObject({ startsAt: '00:00', endsAt: '23:59' });
    expect(parseCreateSlot({ ...valid, startsAt: '12:00', endsAt: '12:01' })).toMatchObject({ endsAt: '12:01' });
  });

  it.each([
    ['an unknown field', { ...valid, partySize: 2 }, 'Unknown field: partySize'],
    ['a missing date', { ...valid, date: undefined }, 'date must be a valid date'],
    ['an impossible day', { ...valid, date: '2026-02-30' }, 'date must be a valid date'],
    ['a missing start', { ...valid, startsAt: undefined }, 'startsAt must be a valid time (HH:MM)'],
    ['a start with seconds', { ...valid, startsAt: '12:00:00' }, 'startsAt must be a valid time (HH:MM)'],
    ['a start of 24:00', { ...valid, startsAt: '24:00' }, 'startsAt must be a valid time (HH:MM)'],
    ['an end of 12:60', { ...valid, endsAt: '12:60' }, 'endsAt must be a valid time (HH:MM)'],
    ['an end equal to the start', { ...valid, endsAt: '12:00' }, 'endsAt must be after startsAt'],
    ['an end before the start', { ...valid, startsAt: '13:00', endsAt: '12:00' }, 'endsAt must be after startsAt'],
    ['a table set that is not an id', { ...valid, tableSetId: '3' }, 'tableSetId must be a positive integer'],
    ['a table set of 0', { ...valid, tableSetId: 0 }, 'tableSetId must be a positive integer'],
  ])('rejects %s', (_name, body, message) => fails(() => parseCreateSlot(body), message));
});

describe('parseListStaffSlots', () => {
  it('reads the two days', () => {
    expect(parseListStaffSlots({ from: '2026-10-01', to: '2026-10-31' })).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(parseListStaffSlots({ from: '2026-10-01', to: '2026-10-01' })).toEqual({ from: '2026-10-01', to: '2026-10-01' });
  });

  it.each([
    ['a missing from', {}, 'from must be a valid date'],
    ['a wrong to', { from: '2026-10-01', to: 'tomorrow' }, 'to must be a valid date'],
    ['two values for a date', { from: ['2026-10-01', '2026-10-02'], to: '2026-10-31' }, 'from must be a valid date'],
    ['a to before the from', { from: '2026-10-31', to: '2026-10-01' }, 'to must not be before from'],
  ])('rejects %s', (_name, query, message) => fails(() => parseListStaffSlots(query), message));
});

describe('parseAssignTableSet', () => {
  it('reads the slot of the path and the table set of the body', () => {
    expect(parseAssignTableSet({ slotId: '13' }, { tableSetId: 3 })).toEqual({ slotId: 13, tableSetId: 3 });
  });

  it.each([
    ['a slot that is not a number', { slotId: 'abc' }, { tableSetId: 3 }, 'slotId must be a positive integer'],
    ['a missing table set', { slotId: '1' }, {}, 'tableSetId must be a positive integer'],
    ['a table set as text', { slotId: '1' }, { tableSetId: '3' }, 'tableSetId must be a positive integer'],
    ['an unknown field', { slotId: '1' }, { tableSetId: 3, date: 'x' }, 'Unknown field: date'],
    ['a body that is not an object', { slotId: '1' }, undefined, 'Request body must be a JSON object'],
  ])('rejects %s', (_name, params, body, message) => fails(() => parseAssignTableSet(params, body), message));
});

describe('output', () => {
  const tableSet = { tableSetId: 3, name: 'Lunch', tables: [{ tableNumber: 1, capacity: 4, tableId: 9 }], totalSeats: 4, extra: 1 };

  it('shapes a table set with its tables and seats only', () => {
    expect(toTableSetDto(tableSet)).toEqual({
      tableSetId: 3, name: 'Lunch', tables: [{ tableNumber: 1, capacity: 4 }], totalSeats: 4,
    });
  });

  it('writes the times of a slot as HH:MM, with its table set or null', () => {
    const slot = { slotId: 12, date: '2026-10-28', startsAt: '12:00:00', endsAt: '13:30:00', tableSet, totalSeats: 4 };
    expect(toStaffSlotDto(slot)).toEqual({
      slotId: 12, date: '2026-10-28', startsAt: '12:00', endsAt: '13:30',
      tableSet: { tableSetId: 3, name: 'Lunch', tables: [{ tableNumber: 1, capacity: 4 }], totalSeats: 4 },
      totalSeats: 4,
    });
    expect(toStaffSlotDto({ ...slot, tableSet: null, totalSeats: 0 })).toMatchObject({ tableSet: null, totalSeats: 0 });
  });
});
