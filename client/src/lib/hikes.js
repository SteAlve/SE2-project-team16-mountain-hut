/**
 * LIB: the rules and the texts of "My hikes" and "Register a hike" (story MH-20, mockup docs/mockups/register-a-hike).
 * Everything here is for display and for building the request: the server decides, and checks the same rules again.
 * Times are 'YYYY-MM-DDTHH:MM' in the hut's time, as the API speaks them: the client never converts a time zone.
 */
import { formatDay, yearOf } from './bookingDates.js';
import { GENERIC, sentence } from './changeBooking.js';

// The start of a hike is the hut by default, and the hiker can change it. Sample data of the mockup, until the hut
// page story gives the real name and altitude.
export const HUT_LABEL = 'Rifugio Alpe Lunga · 2.450 m';

// The limits of the server (DTO and migration of MH-20).
export const START_MAX = 100;
export const DESTINATION_MAX = 100;
export const ROUTE_MAX = 500;
export const POINT_MAX = 100;
export const POINTS_MAX = 100;

// The popular hikes of the form: a fixed list written by the team, with no algorithm behind it. Choosing one only fills
// the form (the times stay empty); the hiker can change everything.
export const POPULAR_HIKES = Object.freeze([
  { id: 'lago-chiaretto', destination: 'Lago Chiaretto', route: 'Via the Chiaretto lake', passagePoints: ['Viso Mozzo'] },
  {
    id: 'passo-alpe-lunga',
    destination: 'Passo Alpe Lunga',
    route: 'Ridge path, then down the south valley',
    passagePoints: ['Colle Basso', 'Pian dei Fiori'],
  },
  { id: 'cima-rossa', destination: 'Cima Rossa', route: 'Normal route, same way back', passagePoints: ['Bivacco Nord'] },
]);

export const NOT_SAVED = 'Nothing has been saved.';

// The moment of the server ('YYYY-MM-DDTHH:MM') from a day and a time of the form, or '' while one is missing.
export const toMoment = (day, time) => (day && time ? `${day}T${time}` : '');

// 'Sat 17 Jul', and the year too when it is not the current one: the field has no other way to show it.
export const formatPickedDay = (day, now = new Date()) =>
  String(now.getFullYear()) === yearOf(day) ? formatDay(day) : `${formatDay(day)} ${yearOf(day)}`;

// What is wrong in the form, as { start, destination, route, departure, return } with the message under each field.
// A field that is fine is left out. `form` has start, destination, route, departureDay, departureTime, returnDay, returnTime.
export function validateHike(form) {
  const errors = {};
  if (!form.start.trim()) errors.start = 'Enter a starting point.';
  if (!form.destination.trim()) errors.destination = 'Enter a destination.';
  if (!form.route.trim()) errors.route = 'Describe your route.';
  const departure = toMoment(form.departureDay, form.departureTime);
  const back = toMoment(form.returnDay, form.returnTime);
  if (!departure) errors.departure = 'Choose the departure day and time.';
  if (!back) errors.return = 'Choose the return day and time.';
  // The return must be after the departure; the same moment is not after.
  else if (departure && back <= departure) errors.return = 'The return must be after the departure.';
  return errors;
}

// The body of POST /api/hikes. The text is trimmed, and a passage point left empty is not sent.
// `points` is [{ id, text }], in the order of the route.
// The start is sent only when the hiker changed it: without `start` the API starts the hike at the hut.
export const buildHikeRequest = (form, points) => ({
  ...(form.start.trim() !== HUT_LABEL ? { start: form.start.trim() } : {}),
  destination: form.destination.trim(),
  route: form.route.trim(),
  passagePoints: points.map(({ text }) => text.trim()).filter(Boolean),
  departureAt: toMoment(form.departureDay, form.departureTime),
  returnAt: toMoment(form.returnDay, form.returnTime),
});

// The list in order of departure (the server sends it so; used when a new hike is put in its place at once).
export const sortHikes = (hikes) =>
  [...hikes].sort((a, b) => a.departureAt.localeCompare(b.departureAt) || a.id - b.id);

// 'Thu 15 Jul, 08:00 – 16:30', or with both days when the hike ends on another day.
export function formatHikeRange({ departureAt, returnAt }) {
  const day = departureAt.slice(0, 10);
  const end = returnAt.slice(11, 16);
  return returnAt.slice(0, 10) === day
    ? `${formatDay(day)}, ${departureAt.slice(11, 16)} – ${end}`
    : `${formatDay(day)}, ${departureAt.slice(11, 16)} – ${formatDay(returnAt.slice(0, 10))}, ${end}`;
}

// The note on the list after a registration.
export const registeredNotice = (hike, email) =>
  `Your hike to ${hike.destination} is registered. We emailed the confirmation to ${email}.`;

// The red note of the dialog when the server refuses the hike. Nothing is saved in any case, and every choice is kept.
// An overlap (409 HIKE_OVERLAP) names the hike in the way; any other failure is the generic note, or the server's
// own message for a refusal it explains (400, 403, 422, another 409).
export function registerFailure(error) {
  const hike = error.details?.hike;
  if (error.status === 409 && error.code === 'HIKE_OVERLAP' && hike) {
    return `These times overlap your hike to ${hike.destination} (${formatHikeRange(hike)}). Choose other times. ${NOT_SAVED}`;
  }
  const explained = [400, 403, 409, 422].includes(error.status);
  return `${explained ? sentence(error.message) : GENERIC} ${NOT_SAVED}`;
}

// The list of the passage points with the point at `from` moved to `to` (both indexes of the list).
export function movePoint(points, from, to) {
  if (from === to || from < 0 || to < 0 || from >= points.length || to >= points.length) return points;
  const next = [...points];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

// Dragging: the line shows where the point lands, as the place `insertAt` in 0..n (before the row of that index, n is
// after the last). It is the number of rows whose middle is above the pointer. `rows` is [{ top, height }] in order.
export const insertIndex = (y, rows) => rows.filter(({ top, height }) => top + height / 2 < y).length;

// The index the dragged point ends up at, once it is taken out of its place.
export const dropTarget = (from, insertAt) => (insertAt > from ? insertAt - 1 : insertAt);

// Dropping before itself or right after itself moves nothing: no line is shown.
export const isNoMove = (from, insertAt) => insertAt === from || insertAt === from + 1;
