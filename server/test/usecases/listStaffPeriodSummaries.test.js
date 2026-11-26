import { describe, expect, it } from 'vitest';
import { ForbiddenError } from '../../src/domain/errors.js';
import { makeListStaffPeriodSummaries } from '../../src/usecases/listStaffPeriodSummaries.js';

const employee = { id: 1, role: 'EMPLOYEE' };
const input = { user: employee, from: '2090-10-02', to: '2090-10-15' };

describe('listStaffPeriodSummaries', () => {
  it('requires staff access and forwards the selected-day range to the dao', async () => {
    let received;
    const findPeriodSummaries = async (...args) => {
      received = args;
      return [{ from: input.from, to: '2090-10-08', slotCount: 0, bookingCount: 0, canReplace: true, days: [] }];
    };

    await expect(makeListStaffPeriodSummaries({ slots: { findPeriodSummaries } })(input))
      .resolves.toHaveLength(1);
    expect(received).toEqual([input.from, input.to]);
  });

  it('rejects a hiker before calling the dao', async () => {
    let called = false;
    const list = makeListStaffPeriodSummaries({
      slots: { findPeriodSummaries: async () => { called = true; } },
    });

    await expect(list({ ...input, user: { id: 2, role: 'HIKER' } })).rejects.toBeInstanceOf(ForbiddenError);
    expect(called).toBe(false);
  });
});
