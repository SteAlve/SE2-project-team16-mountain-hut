/**
 * API: the meal slots, one function per endpoint (see docs/openapi.json, tag "Slots").
 * Public: no login needed.
 */
import { request } from './request.js';

// The bookable slots of a day ('YYYY-MM-DD'). Resolves to [{ slotId, startsAt, endsAt, freeSeats }].
export const getSlots = (date) => request(`/slots?date=${encodeURIComponent(date)}`);
