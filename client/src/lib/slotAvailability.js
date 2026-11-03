/**
 * LIB: what a time slot says to the hiker for a party size (mockup MH-39, "Texts and server answers").
 * A slot that cannot be picked stays visible and says why. The server checks again on booking.
 */
import { formatClosingTime, isClosed } from './bookingDates.js';

// '1 seat', '3 seats'
export const seats = (n) => `${n} ${n === 1 ? 'seat' : 'seats'}`;

// Closed when the server said so when it listed it, or when the clock has passed 2 hours before since.
const isOpen = (slot, day, now) => slot.bookingOpen !== false && !isClosed(day, slot.startsAt, now);

// { bookable, label } for a slot { startsAt, freeSeats, bookingOpen } of `day`.
export function slotAvailability(slot, day, partySize, now) {
  if (!isOpen(slot, day, now)) {
    return { bookable: false, label: `Closed at ${formatClosingTime(day, slot.startsAt)}` };
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
