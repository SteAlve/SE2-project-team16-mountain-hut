import { describe, expect, it } from 'vitest';
import { ConflictError, ForbiddenError, ValidationError } from '../../src/domain/errors.js';
import { makeCopyWeeklySchedule } from '../../src/usecases/copyWeeklySchedule.js';

const employee = { id: 1, role: 'EMPLOYEE' };
const input = {
  user: employee,
  sourceStart: '2090-11-04',
  destinationIntervals: [
    { from: '2090-11-18', to: '2090-12-01' },
    { from: '2090-12-16', to: '2090-12-22' },
  ],
};

describe('copyWeeklySchedule', () => {
  it('requires staff access and forwards all destination intervals to the dao', async () => {
    let received;
    const copyScheduleIntervals = async (value) => {
      received = value;
      return { copiedSlots: 6, replacedSlots: 0 };
    };
    const copy = makeCopyWeeklySchedule({ slots: { copyScheduleIntervals } });

    await expect(copy(input)).resolves.toEqual({ copiedSlots: 6, replacedSlots: 0 });
    expect(received).toEqual({
      sourceStart: input.sourceStart,
      destinationIntervals: input.destinationIntervals,
    });
  });

  it('rejects a hiker before calling the dao', async () => {
    let called = false;
    const copy = makeCopyWeeklySchedule({
      slots: { copyScheduleIntervals: async () => { called = true; } },
    });

    await expect(copy({ ...input, user: { id: 2, role: 'HIKER' } })).rejects.toBeInstanceOf(ForbiddenError);
    expect(called).toBe(false);
  });

  it.each([
    ['INVALID_DESTINATION_INTERVAL', ValidationError],
    ['OVERLAPPING_WEEKS', ValidationError],
    ['EMPTY_SOURCE_WEEK', ValidationError],
  ])('maps %s to a validation error', async (code, ErrorType) => {
    const error = Object.assign(new RangeError('invalid schedule'), { code });
    const copy = makeCopyWeeklySchedule({ slots: { copyScheduleIntervals: async () => { throw error; } } });

    await expect(copy(input)).rejects.toBeInstanceOf(ErrorType);
  });

  it('maps a destination booking to a conflict with its stable code', async () => {
    const error = Object.assign(new RangeError('A destination period contains bookings.'), {
      code: 'WEEK_HAS_BOOKINGS',
    });
    const copy = makeCopyWeeklySchedule({ slots: { copyScheduleIntervals: async () => { throw error; } } });

    await expect(copy(input)).rejects.toMatchObject({
      name: ConflictError.name,
      code: 'WEEK_HAS_BOOKINGS',
    });
  });
});
