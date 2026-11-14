/**
 * LIB: the rules the "Change your booking" dialog shows (story MH-06, mockup docs/mockups/hiker-booking-page).
 * Everything here is for display and for sending only what changed: the server decides whether a
 * change is allowed, and it checks the 48 hours again when the change is saved.
 */
import { formatDay, formatTimeRange, nextDays, toDay } from './bookingDates.js';
import { sameRequirements } from './dietaryNeeds.js';

// A change is admitted until 48 hours before the meal, and the new meal must start at least 48 hours away.
export const CHANGE_NOTICE_MS = 48 * 60 * 60 * 1000;

const startOf = (day, startsAt) => {
  const [y, m, d] = day.split('-').map(Number);
  const [h, min] = startsAt.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
};

// Does a meal of `day` at `startsAt` start at least 48 hours after `now`? Exactly 48 hours counts.
// Used only to hide the times that cannot be chosen: the server answers 422 for them anyway.
export const startsAfterNotice = (day, startsAt, now) =>
  startOf(day, startsAt).getTime() - now.getTime() >= CHANGE_NOTICE_MS;

// The day `count` days after `day` (negative: before), both 'YYYY-MM-DD'.
export const shiftDay = (day, count) => {
  const [y, m, d] = day.split('-').map(Number);
  return toDay(new Date(y, m - 1, d + count));
};

// The first day the strip of the dialog starts from: the first day with a time 48 hours away, or the day of the
// booking when that is earlier. A booking far ahead starts the strip a week before it, not at the first day.
export function stripStart(bookingDay, now) {
  const first = toDay(new Date(now.getTime() + CHANGE_NOTICE_MS));
  if (bookingDay < first) return bookingDay;
  const ahead = nextDays(new Date(`${first}T12:00:00`), 31).includes(bookingDay);
  return ahead ? first : shiftDay(bookingDay, -7);
}

// The booking reference of the emails: QUOTA- and the id on five digits.
export const bookingReference = (id) => `QUOTA-${String(id).padStart(5, '0')}`;

// 'Thu 15 Jul · 13:00', from the 'YYYY-MM-DDTHH:MM' of the server (the hut's time).
export const formatMoment = (moment) => `${formatDay(moment.slice(0, 10))} · ${moment.slice(11, 16)}`;

// The line under the buttons of a booking: { closed, text }, or null when the server did not say the deadline.
export function changeLine({ canChange, changeableUntil }) {
  if (!changeableUntil) return null;
  return canChange
    ? { closed: false, text: `Change until ${formatMoment(changeableUntil)}` }
    : { closed: true, text: `Changes closed on ${formatMoment(changeableUntil)}` };
}

// 'Sat 17 Jul · 13:00 – 14:00 · 4 people', the booking as it is now.
export const bookingNow = ({ date, startsAt, endsAt, partySize }) =>
  `${formatDay(date)} · ${formatTimeRange(startsAt, endsAt)} · ${partySize} ${partySize === 1 ? 'person' : 'people'}`;

// What to send to PATCH /api/bookings/:id: only what is different from the saved booking, so a change of the
// dietary needs alone does not ask the server to seat the party again.
export function buildChanges(booking, { slotId, partySize, requirements }) {
  const changes = {};
  if (slotId !== booking.slotId) changes.slotId = slotId;
  if (partySize !== booking.partySize) changes.partySize = partySize;
  if (!sameRequirements(requirements, booking.requirements)) changes.requirements = requirements;
  return changes;
}

// Only the dietary needs changed: the seats are not checked and the tables stay.
export const isNeedsOnly = (changes) =>
  'requirements' in changes && !('slotId' in changes) && !('partySize' in changes);

// The note of the server's answer to a refused change (mockup "Texts and server answers").
// `error` is { status, code, message }; `slot` is the slot chosen and `partySize` the party.
const GENERIC = 'Something went wrong on our side. Try again in a minute.';
const STAYS = 'Your booking stays as it is.';
const sentence = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);

export function changeFailure(error, { slot, partySize }) {
  if (error.status === 409 && error.code === 'NO_SEATS') {
    const people = `${partySize} ${partySize === 1 ? 'person' : 'people'}`;
    return `There are not enough free seats at ${formatTimeRange(slot.startsAt, slot.endsAt)} for ${people}. ${STAYS}`;
  }
  if (error.status === 409 && error.code === 'BOOKING_CHANGED') {
    return 'This booking was changed in the meantime. Reload it and try again.';
  }
  if (error.status === 422) {
    // The server says which rule failed; the hiker is told what to do next.
    return /already have a booking/i.test(error.message)
      ? `${sentence(error.message)} Choose another day or time.`
      : `${sentence(error.message)} ${STAYS}`;
  }
  if (error.status === 403) return error.message;
  return GENERIC;
}
