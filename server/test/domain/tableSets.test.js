import { describe, expect, it } from 'vitest';
import { describeStaffSlot, describeTableSet, totalSeats } from '../../src/domain/tableSets.js';
import { isStaff } from '../../src/domain/roles.js';

describe('totalSeats', () => {
  it('adds the capacity of every table', () => {
    expect(totalSeats([{ capacity: 4 }, { capacity: 4 }, { capacity: 6 }])).toBe(14);
    expect(totalSeats([])).toBe(0);
  });
});

describe('describeTableSet', () => {
  it('orders the tables by number and adds the seats of the set', () => {
    const set = describeTableSet({
      tableSetId: 3,
      name: 'Lunch',
      tables: [{ tableNumber: 2, capacity: 4 }, { tableNumber: 1, capacity: 6 }],
    });
    expect(set).toEqual({
      tableSetId: 3,
      name: 'Lunch',
      tables: [{ tableNumber: 1, capacity: 6 }, { tableNumber: 2, capacity: 4 }],
      totalSeats: 10,
    });
  });
});

describe('describeStaffSlot', () => {
  const row = { slotId: 12, serviceDate: '2026-10-28', startsAt: '12:00:00', endsAt: '13:00:00', tableSetId: null };

  it('has 0 seats and no table set when the slot has none', () => {
    expect(describeStaffSlot(row, null)).toEqual({
      slotId: 12, date: '2026-10-28', startsAt: '12:00:00', endsAt: '13:00:00', tableSet: null, totalSeats: 0,
    });
  });

  it('has the seats of its table set', () => {
    const tableSet = { tableSetId: 3, name: 'Lunch', tables: [{ tableNumber: 1, capacity: 4 }], totalSeats: 4 };
    expect(describeStaffSlot(row, tableSet)).toMatchObject({ tableSet, totalSeats: 4 });
  });
});

describe('isStaff', () => {
  it('is true for the employees and the warden only', () => {
    expect(isStaff('EMPLOYEE')).toBe(true);
    expect(isStaff('WARDEN')).toBe(true);
    expect(isStaff('HIKER')).toBe(false);
    expect(isStaff(undefined)).toBe(false);
  });
});
