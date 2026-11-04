/**
 * LIB: what a time slot says to the hiker for a party size (mockup MH-39, "Texts and server answers").
 * A slot that cannot be picked stays visible and says why. The server checks again on booking.
 */
import { formatClosingTime, isClosed } from './bookingDates.js';

// '1 seat', '3 seats'
export const seats = (n) => `${n} ${n === 1 ? 'seat' : 'seats'}`;

// Server DTOs are authoritative in the hut's time zone. Local calculation is only for legacy data
// without bookingOpen; the page refreshes server slots every 30 seconds and before confirmation.
const isOpen = (slot, day, now) => typeof slot.bookingOpen === 'boolean' ? slot.bookingOpen : !isClosed(day, slot.startsAt, now);

// { bookable, label } for a slot { startsAt, freeSeats, bookingOpen } of `day`.
export function slotAvailability(slot, day, partySize, now) {
  if (!isOpen(slot, day, now)) {
    const closesAt = slot.bookingClosesAt?.slice(11, 16) || formatClosingTime(day, slot.startsAt);
    return { bookable: false, label: `Closed at ${closesAt}` };
  }
  if (slot.freeSeats === 0) {
    return { bookable: false, label: 'Full' };
  }
  if (slot.freeSeats < partySize) {
    return { bookable: false, label: `Only ${seats(slot.freeSeats)} free` };
  }
  return { bookable: true, label: `${seats(slot.freeSeats)} free` };
}

// The stepper goes up to the most free seats of any open time of the day (at least 1).
export function largestParty(slots, day, now) {
  const open = slots.filter((slot) => isOpen(slot, day, now));
  return Math.max(1, ...open.map((slot) => slot.freeSeats));
}
