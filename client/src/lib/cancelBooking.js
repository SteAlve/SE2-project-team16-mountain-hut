/**
 * LIB: the texts of "Cancel booking" (story MH-08, mockup docs/mockups/hiker-booking-page, screens 11-12).
 * Display only: the server decides, and a booking can be cancelled at any time (product owner).
 */
import { formatDay, formatTimeRange } from './bookingDates.js';
import { bookingReference } from './changeBooking.js';

const GENERIC = 'Something went wrong on our side. Try again in a minute.';

// 'Your table for 4 on Sat 17 Jul, 13:00 – 14:00 will be cancelled.'
export const cancelSummary = ({ partySize, date, startsAt, endsAt }) =>
  `Your table for ${partySize} on ${formatDay(date)}, ${formatTimeRange(startsAt, endsAt)} will be cancelled.`;

// The green note on the list once the booking is cancelled.
export const cancelNotice = (id) => `Booking ${bookingReference(id)} cancelled. We emailed you a confirmation.`;

// The note of a refused cancellation (the booking stays as it is): the server's message for a booking that was
// already cancelled (422), the generic one for a booking that is not found (404) or any other failure.
export function cancelFailure(error) {
  if (error.status === 422) return /[.!?]$/.test(error.message) ? error.message : `${error.message}.`;
  if (error.status === 403) return error.message;
  return GENERIC;
}
