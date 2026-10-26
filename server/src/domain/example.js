/**
 * DOMAIN: here go the business rules, as pure functions (plain values in, plain values out).
 * Not here: HTTP, SQL, Date or a clock (the time arrives as a parameter), imports from other layers.
 *
 * THE CODE BELOW IS JUST AN EXAMPLE (story MH-01: booking closes 2 hours before the slot).
 * Delete this file when the first real one exists.
 */
const HOUR_MS = 60 * 60 * 1000;

export function isBookingOpen(slotStart, now) {
  return slotStart.getTime() - now.getTime() >= 2 * HOUR_MS;
}
