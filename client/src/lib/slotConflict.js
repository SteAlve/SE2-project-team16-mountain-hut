/**
 * LIB: what the Slots page says when a new slot answers 409 (MH-02, issue #85). The day is reloaded
 * in both cases and the other choices are kept:
 *   - code SLOT_OVERLAP: the slot overlaps another slot of that day (start and end are marked);
 *   - no code: a slot starting at the same time already exists (only the start is marked).
 * `form` is { date: 'YYYY-MM-DD', startsAt: 'HH:MM' }. Returns { alert, errors }.
 */
import { formatDay } from './bookingDates.js';

export function slotConflict(error, form) {
  const day = formatDay(form.date);
  if (error.code === 'SLOT_OVERLAP') {
    return {
      alert: `This slot overlaps another slot on ${day}. The day was reloaded: choose times that do not overlap.`,
      errors: { startsAt: 'Overlaps another slot.', endsAt: 'Overlaps another slot.' },
    };
  }
  return {
    alert: `A slot starting at ${form.startsAt} already exists on ${day}. The day was reloaded: choose another start time.`,
    errors: { startsAt: 'Already used.' },
  };
}
