/**
 * Use case helper: can the menu of this slot still be written, changed or deleted? Only until the slot
 * starts: the menu of a slot that has started stays as it is (product owner,
 * SE2-Polito/AY26-27-Mountain-Hut#59). Shared by saveSlotMenu and deleteSlotMenu, so both answer the same.
 * Throws UnprocessableError (422) with the code MENU_LOCKED. `slot` is a row of findMenuById.
 */
import { UnprocessableError } from '../domain/errors.js';
import { isMenuOpen } from '../domain/menu.js';

export const makeCheckMenuOpen = ({ clock, hutTimeZone }) => (slot) => {
  const startsAt = clock.at(slot.serviceDate, slot.startsAt, hutTimeZone);
  if (!isMenuOpen(startsAt, clock.now())) {
    throw new UnprocessableError('The slot has started: its menu can no longer be changed', { code: 'MENU_LOCKED' });
  }
};
