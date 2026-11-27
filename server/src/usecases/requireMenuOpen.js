/**
 * Use case helper (MH-10): the menu of a slot can be changed or deleted only before the slot starts
 * (domain/slotMenu.js, isMenuOpen). Throws UnprocessableError (422) when the slot has started.
 * `slot` is a row of the slot dao (findMenuById).
 */
import { UnprocessableError } from '../domain/errors.js';
import { isMenuOpen } from '../domain/slotMenu.js';

export const requireMenuOpen = (slot, { clock, hutTimeZone }) => {
  const slotStartsAt = clock.at(slot.serviceDate, slot.startsAt, hutTimeZone);
  if (!isMenuOpen(slotStartsAt, clock.now())) {
    throw new UnprocessableError('The slot has started: its menu can no longer be changed');
  }
};
