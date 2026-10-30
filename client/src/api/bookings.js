/**
 * API: the table bookings, one function per endpoint (see docs/openapi.json, tag "Bookings").
 * Needs a logged-in hiker: the session cookie is sent by the browser.
 */
import { request } from './request.js';

// Books the tables of the seating preview, sent back unchanged. Resolves to the booking
// { id, date, slotId, partySize, tables }. Rejects with ApiError 401 (not logged in), 403 (not a hiker),
// 404 (no such slot), 409 with code NO_SEATS (the party does not fit any more) or TABLES_CHANGED
// (it fits, but at other tables: ask a new preview), 422 (booking closed, or already booked this slot).
export const createBooking = ({ slotId, partySize, tables }) =>
  request('/bookings', { method: 'POST', body: JSON.stringify({ slotId, partySize, tables }) });
