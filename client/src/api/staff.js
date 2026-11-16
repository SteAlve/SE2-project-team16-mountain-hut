/**
 * API: the table sets and the slots of the staff (MH-02) and the reservations for a hiker (MH-07),
 * one function per endpoint (see docs/openapi.json, tag "Staff"). Needs a logged-in employee or
 * warden: the session cookie is sent by the browser.
 * Every function rejects with ApiError 401 (not logged in) or 403 (not staff), besides the ones listed.
 */
import { request } from './request.js';

// Every table set. Resolves to [{ tableSetId, name, tables: [{ tableNumber, capacity }], totalSeats }].
export const getTableSets = () => request('/staff/table-sets');

// Resolves to the new table set. Rejects with ApiError 400 (wrong tables) or 409 (name already used).
export const createTableSet = ({ name, tables }) =>
  request('/staff/table-sets', { method: 'POST', body: JSON.stringify({ name, tables }) });

// The slots from `from` to `to` ('YYYY-MM-DD', both included), also the ones without tables, in
// order of day and time. Resolves to [{ slotId, date, startsAt, endsAt, tableSet, totalSeats }].
export const getStaffSlots = (from, to) =>
  request(`/staff/slots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);

// `tableSetId` null: a slot with no tables yet. Resolves to the new slot. Rejects with ApiError 400,
// 404 (no such table set) or 409 (a slot starting at that time already exists on that day).
export const createSlot = ({ date, startsAt, endsAt, tableSetId }) =>
  request('/staff/slots', {
    method: 'POST',
    body: JSON.stringify({ date, startsAt, endsAt, ...(tableSetId !== null && { tableSetId }) }),
  });

// Gives a table set to a slot without tables. Resolves to the slot. Rejects with ApiError 404 (no
// such slot or table set) or 409 (the slot already has another table set).
export const assignTableSet = (slotId, tableSetId) =>
  request(`/staff/slots/${encodeURIComponent(slotId)}/table-set`, {
    method: 'PUT',
    body: JSON.stringify({ tableSetId }),
  });

// The reservations for a hiker (MH-07).

// The regular hiker accounts whose name, email or phone contain `text` (at least 2 characters),
// at most 20. Temporary hikers and the staff are never listed. Resolves to
// [{ id, firstName, lastName, email, phone, temporary }]. Rejects with ApiError 400 (text too short).
export const searchHikers = (text) => request(`/staff/hikers?q=${encodeURIComponent(text)}`);

// With an email: a hiker account, whose password the server emails to the hiker. Without one
// (`email` null): a temporary hiker, who cannot log in. Resolves to the new hiker, as searchHikers.
// Rejects with ApiError 400 (wrong fields) or 409 (an account already has this email).
export const createHiker = ({ firstName, lastName, email, phone }) =>
  request('/staff/hikers', {
    method: 'POST',
    body: JSON.stringify({ firstName, lastName, ...(email && { email }), ...(phone && { phone }) }),
  });

// Where a party would sit, with the time limit of the staff (until the meal starts). Resolves to
// { slotId, partySize, tables: [{ tableNumber, seats }] }. Rejects with ApiError 404 (no such slot),
// 409 code NO_SEATS (the party does not fit) or 422 (the slot has no tables or has started).
export const getStaffSeating = (slotId, partySize) =>
  request(`/staff/slots/${encodeURIComponent(slotId)}/seating?partySize=${encodeURIComponent(partySize)}`);

// Books the tables of getStaffSeating, sent back unchanged, for the hiker. Resolves to the booking
// { id, date, slotId, partySize, tables }. Rejects with ApiError 404 (no such slot or hiker),
// 409 code NO_SEATS or TABLES_CHANGED (as POST /api/bookings), 422 (the slot has started, or the
// hiker already has a booking for it).
export const createStaffBooking = ({ hikerId, slotId, partySize, tables }) =>
  request('/staff/bookings', {
    method: 'POST',
    body: JSON.stringify({ hikerId, slotId, partySize, tables }),
  });
