import { describe, expect, it, vi } from 'vitest';
import { makeCheckSlotOpen } from '../../src/usecases/checkSlotOpen.js';
import { UnprocessableError } from '../../src/domain/errors.js';

const zone = 'Europe/Rome';
const slot = {
  slotId: 12,
  serviceDate: '2026-10-28',
  startsAt: '12:00:00',
  endsAt: '13:00:00',
  tableSetId: 3,
};
const mealStartsAt = new Date('2026-10-28T11:00:00Z');
const closesAt = new Date(mealStartsAt.getTime() - 2 * 60 * 60 * 1000);

const checkerAt = (now) => {
  const clock = {
    at: vi.fn(() => mealStartsAt),
    now: vi.fn(() => now),
  };
  return { check: makeCheckSlotOpen({ clock, hutTimeZone: zone }), clock };
};

describe('checkSlotOpen', () => {
  it('allows booking exactly two hours before the meal', () => {
    const { check, clock } = checkerAt(closesAt);

    expect(() => check(slot)).not.toThrow();
    expect(clock.at).toHaveBeenCalledWith(slot.serviceDate, slot.startsAt, zone);
  });

  it('allows booking before the two-hour closing time', () => {
    const { check } = checkerAt(new Date(closesAt.getTime() - 1));

    expect(() => check(slot)).not.toThrow();
  });

  it('closes booking immediately after the two-hour limit', () => {
    const { check } = checkerAt(new Date(closesAt.getTime() + 1));

    expect(() => check(slot)).toThrow(UnprocessableError);
  });

  it('rejects a slot without a table set without consulting the clock', () => {
    const { check, clock } = checkerAt(new Date('2026-10-28T08:00:00Z'));

    expect(() => check({ ...slot, tableSetId: null })).toThrow(
      new UnprocessableError(`Slot ${slot.slotId} is not available for booking`),
    );
    expect(clock.at).not.toHaveBeenCalled();
    expect(clock.now).not.toHaveBeenCalled();
  });
});
