import { describe, expect, it, vi } from 'vitest';
import { makePreviewStaffSeating } from '../../src/usecases/previewStaffSeating.js';
import { ForbiddenError } from '../../src/domain/errors.js';

const employee = { id: 1, role: 'EMPLOYEE' };
const hiker = { id: 2, role: 'HIKER' };
const slot = { slotId: 12, serviceDate: '2090-11-04', startsAt: '12:00:00', tableSetId: 8 };

function setup() {
  const slots = {
    findById: vi.fn().mockResolvedValue(slot),
    findAvailableTablesBySlotId: vi.fn().mockResolvedValue([{ tableId: 3, tableNumber: 7, freeSeats: 4 }]),
  };
  const checkSlotOpen = vi.fn();
  return {
    slots, checkSlotOpen,
    preview: makePreviewStaffSeating({ slots, checkSlotOpen }),
  };
}

describe('previewStaffSeating use case', () => {
  it('uses the staff preview path and returns the proposed tables', async () => {
    const t = setup();

    await expect(t.preview({ user: employee, slotId: 12, partySize: 3 })).resolves.toEqual({
      slotId: 12, partySize: 3, tables: [{ tableNumber: 7, seats: 3 }],
    });
    expect(t.checkSlotOpen).toHaveBeenCalledExactlyOnceWith(slot);
    expect(t.slots.findAvailableTablesBySlotId).toHaveBeenCalledExactlyOnceWith(12);
  });

  it('refuses a hiker before looking up the slot', async () => {
    const t = setup();

    await expect(t.preview({ user: hiker, slotId: 12, partySize: 3 }))
      .rejects.toThrow(new ForbiddenError('Only the staff can do this'));
    expect(t.slots.findById).not.toHaveBeenCalled();
  });
});
