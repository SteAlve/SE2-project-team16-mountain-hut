import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError, NotFoundError, UnprocessableError } from '../../src/domain/errors.js';
import { makeDeleteSlotMenu } from '../../src/usecases/deleteSlotMenu.js';
import { makeSaveSlotMenu } from '../../src/usecases/saveSlotMenu.js';

const employee = { id: 1, role: 'EMPLOYEE' };
const hiker = { id: 2, role: 'HIKER' };
const slot = { slotId: 12, serviceDate: '2090-07-18', startsAt: '19:00:00', endsAt: '21:00:00', menu: null };
const slotStart = new Date('2090-07-18T17:00:00.000Z');
const savedAt = new Date('2090-07-10T08:00:00.000Z');

const setup = ({ found = slot, now = savedAt, deleted = true } = {}) => {
  const slots = {
    findMenuById: vi.fn().mockResolvedValue(found),
    saveMenu: vi.fn(async (slotId, menu) => ({ ...slot, slotId, menu })),
    deleteMenu: vi.fn().mockResolvedValue(deleted),
  };
  const clock = {
    at: vi.fn(() => slotStart),
    now: vi.fn(() => now),
  };
  return {
    slots,
    clock,
    save: makeSaveSlotMenu({ slots, clock, hutTimeZone: 'Europe/Rome' }),
    remove: makeDeleteSlotMenu({ slots, clock, hutTimeZone: 'Europe/Rome' }),
  };
};

describe('saveSlotMenu', () => {
  it('saves a normalized menu only for the selected slot', async () => {
    const test = setup();

    await expect(test.save({ user: employee, slotId: 12, menu: '**Dinner**  \r\n- Soup\n' })).resolves.toEqual({
      slotId: 12,
      date: '2090-07-18',
      startsAt: '19:00:00',
      endsAt: '21:00:00',
      menu: '**Dinner**\n- Soup',
    });
    expect(test.slots.saveMenu).toHaveBeenCalledWith(12, '**Dinner**\n- Soup', savedAt);
    expect(test.clock.at).toHaveBeenCalledWith(slot.serviceDate, slot.startsAt, 'Europe/Rome');
  });

  it('does not save after the slot starts', async () => {
    const test = setup({ now: new Date(slotStart.getTime() + 1) });

    await expect(test.save({ user: employee, slotId: 12, menu: 'Soup' })).rejects.toThrow(UnprocessableError);
    expect(test.slots.saveMenu).not.toHaveBeenCalled();
  });

  it('rejects a missing slot and non-staff user', async () => {
    const missing = setup({ found: null });
    await expect(missing.save({ user: employee, slotId: 99, menu: 'Soup' })).rejects.toThrow(NotFoundError);

    const forbidden = setup();
    await expect(forbidden.save({ user: hiker, slotId: 12, menu: 'Soup' })).rejects.toThrow(ForbiddenError);
    expect(forbidden.slots.findMenuById).not.toHaveBeenCalled();
  });
});

describe('deleteSlotMenu', () => {
  it('deletes only the selected future slot menu', async () => {
    const test = setup({ found: { ...slot, menu: 'Soup' } });

    await expect(test.remove({ user: employee, slotId: 12 })).resolves.toBeUndefined();
    expect(test.slots.deleteMenu).toHaveBeenCalledWith(12);
  });

  it('does not delete a started slot menu', async () => {
    const test = setup({ found: { ...slot, menu: 'Soup' }, now: new Date(slotStart.getTime() + 1) });

    await expect(test.remove({ user: employee, slotId: 12 })).rejects.toThrow(UnprocessableError);
    expect(test.slots.deleteMenu).not.toHaveBeenCalled();
  });

  it('reports a missing slot or a concurrent deletion', async () => {
    await expect(setup({ found: null }).remove({ user: employee, slotId: 99 })).rejects.toThrow(NotFoundError);
    await expect(setup({ deleted: false }).remove({ user: employee, slotId: 12 })).rejects.toThrow(NotFoundError);
  });
});
