/**
 * API: the table sets and the slots of the staff, one function per endpoint (see docs/openapi.json,
 * tag "Staff"). Needs a logged-in employee or warden: the session cookie is sent by the browser.
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
