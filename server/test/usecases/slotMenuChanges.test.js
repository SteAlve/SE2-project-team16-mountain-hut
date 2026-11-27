// The menu of a slot can be written, changed or deleted only until the slot starts (MH-10, product
// owner SE2-Polito/AY26-27-Mountain-Hut#59): checkMenuOpen, saveSlotMenu and deleteSlotMenu.
import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError, NotFoundError, UnprocessableError, ValidationError } from '../../src/domain/errors.js';
import { makeCheckMenuOpen } from '../../src/usecases/checkMenuOpen.js';
import { makeDeleteSlotMenu } from '../../src/usecases/deleteSlotMenu.js';
import { makeSaveSlotMenu } from '../../src/usecases/saveSlotMenu.js';

const zone = 'Europe/Rome';
const employee = { id: 1, role: 'EMPLOYEE' };
const hiker = { id: 2, role: 'HIKER' };
const slot = { slotId: 12, serviceDate: '2090-07-18', startsAt: '19:00:00', endsAt: '21:00:00', menu: null };
const startsAt = new Date('2090-07-18T17:00:00Z');
const savedAt = new Date('2090-07-10T08:00:00Z');

const clockAt = (now) => ({ at: vi.fn(() => startsAt), now: vi.fn(() => now) });

describe('checkMenuOpen', () => {
  it('lets the menu change before the slot starts, and at its start', () => {
    const clock = clockAt(startsAt);
    const check = makeCheckMenuOpen({ clock, hutTimeZone: zone });

    expect(() => check(slot)).not.toThrow();
    expect(clock.at).toHaveBeenCalledWith(slot.serviceDate, slot.startsAt, zone);
    expect(() => makeCheckMenuOpen({ clock: clockAt(new Date(startsAt.getTime() - 1)), hutTimeZone: zone })(slot))
      .not.toThrow();
  });

  it('keeps the menu fixed once the slot has started', () => {
    const check = makeCheckMenuOpen({ clock: clockAt(new Date(startsAt.getTime() + 1)), hutTimeZone: zone });

    expect(() => check(slot)).toThrow(UnprocessableError);
    try {
      check(slot);
    } catch (error) {
      expect(error.code).toBe('MENU_LOCKED');
    }
  });
});

function setup({ found = slot, locked = false } = {}) {
  const slots = {
    findMenuById: vi.fn().mockResolvedValue(found),
    saveMenu: vi.fn(async (slotId, menu) => ({ ...slot, slotId, menu })),
    deleteMenu: vi.fn().mockResolvedValue(true),
  };
  const checkMenuOpen = vi.fn(() => {
    if (locked) throw new UnprocessableError('The slot has started', { code: 'MENU_LOCKED' });
  });
  const clock = { now: vi.fn(() => savedAt) };
  return {
    slots,
    checkMenuOpen,
    save: makeSaveSlotMenu({ slots, clock, checkMenuOpen }),
    remove: makeDeleteSlotMenu({ slots, checkMenuOpen }),
  };
}

describe('saveSlotMenu', () => {
  it('saves the cleaned menu of a slot that has not started', async () => {
    const t = setup();

    await expect(t.save({ user: employee, slotId: 12, menu: '**Dinner**  \r\n- Soup\n\n' })).resolves.toEqual({
      slotId: 12, date: '2090-07-18', startsAt: '19:00:00', endsAt: '21:00:00', menu: '**Dinner**\n- Soup',
    });
    expect(t.checkMenuOpen).toHaveBeenCalledExactlyOnceWith(slot);
    expect(t.slots.saveMenu).toHaveBeenCalledExactlyOnceWith(12, '**Dinner**\n- Soup', savedAt);
  });

  it('does not change the menu of a slot that has started (422 MENU_LOCKED)', async () => {
    const t = setup({ locked: true });

    await expect(t.save({ user: employee, slotId: 12, menu: 'Soup' })).rejects.toMatchObject({ code: 'MENU_LOCKED' });
    expect(t.slots.saveMenu).not.toHaveBeenCalled();
  });

  it('answers 404 for a slot that does not exist', async () => {
    const t = setup({ found: null });

    await expect(t.save({ user: employee, slotId: 99, menu: 'Soup' })).rejects.toThrow(NotFoundError);
    expect(t.slots.saveMenu).not.toHaveBeenCalled();
  });

  it('checks the menu before looking for the slot', async () => {
    const t = setup();

    await expect(t.save({ user: employee, slotId: 12, menu: '  ' })).rejects.toThrow(ValidationError);
    expect(t.slots.findMenuById).not.toHaveBeenCalled();
  });

  it('refuses a hiker', async () => {
    const t = setup();

    await expect(t.save({ user: hiker, slotId: 12, menu: 'Soup' })).rejects.toThrow(ForbiddenError);
    expect(t.slots.findMenuById).not.toHaveBeenCalled();
  });
});

describe('deleteSlotMenu', () => {
  it('deletes the menu of a slot that has not started', async () => {
    const t = setup({ found: { ...slot, menu: 'Soup' } });

    await expect(t.remove({ user: employee, slotId: 12 })).resolves.toBeUndefined();
    expect(t.slots.deleteMenu).toHaveBeenCalledExactlyOnceWith(12);
  });

  it('keeps the menu of a slot that has started (422 MENU_LOCKED)', async () => {
    const t = setup({ found: { ...slot, menu: 'Soup' }, locked: true });

    await expect(t.remove({ user: employee, slotId: 12 })).rejects.toMatchObject({ code: 'MENU_LOCKED' });
    expect(t.slots.deleteMenu).not.toHaveBeenCalled();
  });

  it('answers 404 for a slot that does not exist', async () => {
    const t = setup({ found: null });

    await expect(t.remove({ user: employee, slotId: 99 })).rejects.toThrow(NotFoundError);
    expect(t.slots.deleteMenu).not.toHaveBeenCalled();
  });

  it('answers 404 when the slot is deleted meanwhile', async () => {
    const t = setup();
    t.slots.deleteMenu.mockResolvedValue(false);

    await expect(t.remove({ user: employee, slotId: 12 })).rejects.toThrow(NotFoundError);
  });

  it('refuses a hiker', async () => {
    const t = setup();

    await expect(t.remove({ user: hiker, slotId: 12 })).rejects.toThrow(ForbiddenError);
    expect(t.slots.findMenuById).not.toHaveBeenCalled();
  });
});
