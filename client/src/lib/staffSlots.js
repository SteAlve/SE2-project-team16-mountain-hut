/**
 * LIB: what a time slot says to the employee who enters a reservation for a hiker (MH-07, mockup
 * docs/mockups/reservation-for-a-hiker, "Texts and server answers").
 * The staff can enter a reservation until the time starts: the 2-hour limit of the hikers does not
 * apply. The server checks it again (422) when the employee saves.
 * Days are 'YYYY-MM-DD' and times 'HH:MM', in the hut's time: the staff work at the hut, so the
 * clock of their browser is the clock of the hut.
 */
import { formatDay, formatTime, toDay } from './bookingDates.js';
import { seats } from './slotAvailability.js';

// The instant the slot starts.
export const startTime = (day, startsAt) => {
  const [y, m, d] = day.split('-').map(Number);
  const [h, min] = startsAt.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
};

// The exact start is still open, as on the server (domain/bookingWindow.js, isOpenForStaff).
export const hasStarted = (day, startsAt, now) => now.getTime() > startTime(day, startsAt).getTime();

// { bookable, label } for a slot { startsAt, freeSeats } of `day` and a party of `partySize`.
// A slot that cannot be picked stays visible and its label says why.
export function staffSlotAvailability(slot, day, partySize, now) {
  if (hasStarted(day, slot.startsAt, now)) {
    return { bookable: false, label: `Started at ${formatTime(slot.startsAt)}` };
  }
  if (slot.freeSeats === 0) return { bookable: false, label: 'Full' };
  if (slot.freeSeats < partySize) return { bookable: false, label: `Only ${seats(slot.freeSeats)} free` };
  return { bookable: true, label: `${seats(slot.freeSeats)} free` };
}

// 'today' or 'on Sat 17 Jul', after a time.
export const onDay = (day, now) => (day === toDay(now) ? 'today' : `on ${formatDay(day)}`);

// 'Today, Sat 17 Jul' or 'Sat 17 Jul', for the summary.
export const dayLabel = (day, now) => (day === toDay(now) ? `Today, ${formatDay(day)}` : formatDay(day));

// '13:00 today' or '13:00 on Sat 17 Jul': until when the time can be entered, its start.
export const enterUntil = (day, startsAt, now) => `${formatTime(startsAt)} ${onDay(day, now)}`;
