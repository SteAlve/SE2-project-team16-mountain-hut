// MH-66 / MH-04: supplement the preview tests in bookings.test.js with the PO's split-seat
// examples, completely full slots and repeated public checks. No database or authentication.
import { describe, expect, it, vi } from 'vitest';
import { makePreviewSeating } from '../../src/usecases/previewSeating.js';
import { makeCheckSlotOpen } from '../../src/usecases/checkSlotOpen.js';
import { clock } from '../../src/clock.js';

const slot = {
  slotId: 12, serviceDate: '2090-11-04', startsAt: '12:00:00', endsAt: '13:00:00', tableSetId: 8,
};
const table = (tableId, tableNumber, freeSeats) => ({ tableId, tableNumber, freeSeats });

function setup(layout) {
  const slots = {
    findById: vi.fn().mockResolvedValue(slot),
    findAvailableTablesBySlotId: vi.fn().mockResolvedValue(layout),
  };
  const checkSlotOpen = makeCheckSlotOpen({
    clock: { at: clock.at, now: () => new Date('2090-11-03T09:00:00Z') },
    hutTimeZone: 'Europe/Rome',
  });
  return { slots, preview: makePreviewSeating({ slots, checkSlotOpen }) };
}

describe('MH-04 availability through previewSeating', () => {
  it('accepts an exact fit of six people over three tables of two (PO example)', async () => {
    const t = setup([table(81, 3, 2), table(15, 1, 2), table(42, 2, 2)]);

    await expect(t.preview({ slotId: 12, partySize: 6 })).resolves.toEqual({
      slotId: 12, partySize: 6,
      tables: [{ tableNumber: 1, seats: 2 }, { tableNumber: 2, seats: 2 }, { tableNumber: 3, seats: 2 }],
    });
    expect(t.slots.findById).toHaveBeenCalledExactlyOnceWith(12);
    expect(t.slots.findAvailableTablesBySlotId).toHaveBeenCalledExactlyOnceWith(12);
  });

  it('returns the actual split detail, including partially occupied tables (2 + 3 + 1)', async () => {
    const layout = [table(90, 4, 1), table(12, 1, 2), table(35, 2, 3), table(6, 3, 0)];
    const original = structuredClone(layout);
    const t = setup(layout);

    await expect(t.preview({ slotId: 12, partySize: 6 })).resolves.toEqual({
      slotId: 12, partySize: 6,
      tables: [{ tableNumber: 1, seats: 2 }, { tableNumber: 2, seats: 3 }, { tableNumber: 4, seats: 1 }],
    });
    expect(layout).toEqual(original);
  });

  it.each([
    ['all tables are full', [table(81, 1, 0), table(42, 2, 0)]],
    ['the assigned table set has no tables', []],
  ])('reports NO_SEATS when %s, even for one person', async (_name, layout) => {
    const t = setup(layout);

    await expect(t.preview({ slotId: 12, partySize: 1 })).rejects.toMatchObject({
      name: 'ConflictError', code: 'NO_SEATS', message: 'Not enough free seats',
    });
  });

  it('rechecks current free seats on each request, without holding or changing them', async () => {
    const layout = [table(81, 1, 2), table(42, 2, 2), table(15, 3, 2)];
    const t = setup(layout);
    const input = { slotId: 12, partySize: 6 };
    const first = await t.preview(input);

    expect(await t.preview(input)).toEqual(first);
    expect(layout.map(({ freeSeats }) => freeSeats)).toEqual([2, 2, 2]);

    // Another booking has used one seat since the last check.
    t.slots.findAvailableTablesBySlotId.mockResolvedValue([
      table(81, 1, 1), table(42, 2, 2), table(15, 3, 2),
    ]);
    await expect(t.preview(input)).rejects.toMatchObject({ name: 'ConflictError', code: 'NO_SEATS' });
    expect(t.slots.findAvailableTablesBySlotId).toHaveBeenCalledTimes(3);
  });
});
