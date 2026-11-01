/**
 * API: the meal slots, one function per endpoint (see docs/openapi.json, tag "Slots").
 * Public: no login needed.
 */
import { request } from './request.js';

// Every slot from today on (today of the hut), full or closed ones too. Resolves to
// [{ slotId, date, startsAt, endsAt, freeSeats, bookingOpen, bookingClosesAt }].
export const getSlots = () => request('/slots');

// Where a party would sit, without booking. Resolves to { slotId, partySize, tables: [{ tableNumber, seats }] }.
// Rejects with ApiError 404 (no such slot), 409 code NO_SEATS (the party does not fit), 422 (booking closed).
export const getSeating = (slotId, partySize) =>
  request(`/slots/${encodeURIComponent(slotId)}/seating?partySize=${encodeURIComponent(partySize)}`);
