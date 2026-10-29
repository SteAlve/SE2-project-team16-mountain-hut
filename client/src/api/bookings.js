/**
 * API: the table bookings, one function per endpoint (see docs/openapi.json, tag "Bookings").
 * Needs a logged-in hiker: the session cookie is sent by the browser.
 */
import { request } from './request.js';

// Resolves to the booking { id, date, slotId, partySize }. Rejects with ApiError
// 401 (not logged in), 403 (not a hiker), 409 (not enough seats), 422 (booking closed).
export const createBooking = ({ date, slotId, partySize }) =>
  request('/bookings', { method: 'POST', body: JSON.stringify({ date, slotId, partySize }) });
