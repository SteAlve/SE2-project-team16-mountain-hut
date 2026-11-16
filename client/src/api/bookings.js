/**
 * API: the table bookings, one function per endpoint (see docs/openapi.json, tag "Bookings").
 * Needs a logged-in hiker: the session cookie is sent by the browser.
 */
import { request } from './request.js';

// Books the tables of the seating preview, sent back unchanged, with the dietary needs of the party
// (MH-05): `requirements`, one per guest who has any, possibly empty. Resolves to the booking
// { id, date, slotId, partySize, tables, requirements }, each requirement with its hasAllergies flag.
// Rejects with ApiError 400 (wrong requirements), 401 (not logged in), 403 (not a hiker),
// 404 (no such slot), 409 with code NO_SEATS (the party does not fit any more) or TABLES_CHANGED
// (it fits, but at other tables: ask a new preview), 422 (booking closed, or already booked this slot).
export const createBooking = ({ slotId, partySize, tables, requirements = [] }) =>
  request('/bookings', { method: 'POST', body: JSON.stringify({ slotId, partySize, tables, requirements }) });

// The bookings of the logged-in hiker from today on, not cancelled, in order of day and time. Resolves to
// [{ id, slotId, date, startsAt, endsAt, partySize, tables, requirements, canChange, changeableUntil }].
// Rejects with ApiError 401 (not logged in) or 403 (not a hiker).
export const listMyBookings = () => request('/bookings');

// Changes a booking (MH-06): `changes` has at least one of slotId, partySize and requirements; what is not
// sent stays as it is, and the server chooses the tables. Resolves to the booking as it is now
// { id, slotId, date, startsAt, endsAt, partySize, tables, requirements } (without canChange).
// Rejects with ApiError 400, 401, 403, 404 (no such booking or slot), 409 with code NO_SEATS (the party does not
// fit) or BOOKING_CHANGED (changed at the same moment), 422 (changes closed, already booked, no tables, too many needs).
export const changeBooking = (bookingId, changes) =>
  request(`/bookings/${encodeURIComponent(bookingId)}`, { method: 'PATCH', body: JSON.stringify(changes) });
