/**
 * LIB: the rules the "Change your booking" dialog shows (story MH-06, mockup docs/mockups/hiker-booking-page).
 * Everything here is for display and for sending only what changed: the server decides whether a
 * change is allowed, and it checks the 48 hours again when the change is saved.
 */
import { formatDay, formatTimeRange, nextDays, toDay } from './bookingDates.js';
import { sameRequirements } from './dietaryNeeds.js';

// A change is admitted until 48 hours before the meal, and the new meal must start at least 48 hours away.
export const CHANGE_NOTICE_MS = 48 * 60 * 60 * 1000;

// The hut's time zone: the server counts the 48 hours there (HUT_TIME_ZONE, Europe/Rome by default), whatever the
// time zone of the browser is. VITE_HUT_TIME_ZONE can set the same value for the client.
export const HUT_TIME_ZONE = import.meta.env?.VITE_HUT_TIME_ZONE ?? 'Europe/Rome';

const wallClock = new Intl.DateTimeFormat('en-US', {
  timeZone: HUT_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

// The wall clock of the hut at an instant, as the number of ms the same figures would be in UTC.
const hutWallAsUtc = (ms) => {
  const p = Object.fromEntries(wallClock.formatToParts(new Date(ms)).map(({ type, value }) => [type, Number(value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
};

// The day ('YYYY-MM-DD') it is at the hut at this instant.
export const hutDay = (date) => new Date(hutWallAsUtc(date.getTime())).toISOString().slice(0, 10);

// The moment ('YYYY-MM-DDTHH:MM') it is at the hut at this instant, as the API writes the times of a hike (MH-20).
export const hutMoment = (date) => new Date(hutWallAsUtc(date.getTime())).toISOString().slice(0, 16);

// The instant of 'HH:MM' of `day` at the hut.
export function hutInstant(day, hhmm) {
  const [y, m, d] = day.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, h, min);
  // Two passes settle the offset also next to a change of the summer time.
  const first = wall - (hutWallAsUtc(wall) - wall);
  return new Date(wall - (hutWallAsUtc(first) - first));
}

// Does a meal of `day` at `startsAt` (the hut's time) start at least 48 hours after `now`? Exactly 48 hours counts.
// Used only to hide the times that cannot be chosen: the server answers 422 for them anyway.
export const startsAfterNotice = (day, startsAt, now) =>
  hutInstant(day, startsAt).getTime() - now.getTime() >= CHANGE_NOTICE_MS;

// The day `count` days after `day` (negative: before), both 'YYYY-MM-DD'.
export const shiftDay = (day, count) => {
  const [y, m, d] = day.split('-').map(Number);
  return toDay(new Date(y, m - 1, d + count));
};

// The first day (at the hut) the strip of the dialog starts from: the first day with a time 48 hours away, or the day of the
// booking when that is earlier. A booking far ahead starts the strip a week before it, not at the first day.
export function stripStart(bookingDay, now) {
  const first = hutDay(new Date(now.getTime() + CHANGE_NOTICE_MS));
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

// Can the change be saved? Something must differ, and either a time is chosen or only the dietary needs changed
// with the day and time left as they are (so they can be saved even if the times did not load). When the hiker
// moved to another day (or left the time empty) a time must be chosen first.
export function canSaveChange({ changes, slot, timeTouched, isPending }) {
  if (isPending || Object.keys(changes).length === 0) return false;
  if (slot) return true;
  return isNeedsOnly(changes) && !timeTouched;
}

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
export const GENERIC = 'Something went wrong on our side. Try again in a minute.';
const STAYS = 'Your booking stays as it is.';
export const sentence = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);

// A change refused (422) because the booking was cancelled in the meantime, for example in another tab: it is no
// longer there, like a booking that is not found.
export const isCancelledFailure = (error) => error.status === 422 && /was cancelled/i.test(error.message);

export function changeFailure(error, { slot, partySize }) {
  if (error.status === 409 && error.code === 'NO_SEATS') {
    const people = `${partySize} ${partySize === 1 ? 'person' : 'people'}`;
    return `There are not enough free seats at ${formatTimeRange(slot.startsAt, slot.endsAt)} for ${people}. ${STAYS}`;
  }
  if (error.status === 409 && error.code === 'BOOKING_CHANGED') {
    return 'This booking was changed in the meantime, so nothing was saved. Its new details are below: open it again to change it.';
  }
  if (error.status === 404) return 'This booking is no longer in your list, so nothing was saved.';
  if (isCancelledFailure(error)) return 'This booking was cancelled, so nothing was saved.';
  if (error.status === 422) {
    // The server says which rule failed; the hiker is told what to do next.
    return /already have a booking/i.test(error.message)
      ? `${sentence(error.message)} Choose another day or time.`
      : `${sentence(error.message)} ${STAYS}`;
  }
  if (error.status === 403) return error.message;
  return GENERIC;
}
