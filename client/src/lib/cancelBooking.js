/**
 * LIB: the texts of "Cancel booking" (story MH-08, mockup docs/mockups/hiker-booking-page, screens 11-12).
 * Display only: the server decides, and a booking can be cancelled at any time (product owner).
 */
import { formatDay, formatTimeRange } from './bookingDates.js';
import { bookingReference, GENERIC, sentence } from './changeBooking.js';

// 'Your table for 4 on Sat 17 Jul, 13:00 – 14:00 will be cancelled.'
export const cancelSummary = ({ partySize, date, startsAt, endsAt }) =>
  `Your table for ${partySize} on ${formatDay(date)}, ${formatTimeRange(startsAt, endsAt)} will be cancelled.`;

// The green note on the list once the booking is cancelled.
export const cancelNotice = (id) => `Booking ${bookingReference(id)} cancelled. We emailed you a confirmation.`;

// The note of a refused cancellation. A booking that is not there any more says so (404, or the server's message
// when it was already cancelled, 422): the dialog closes and the list is loaded again. Any other failure is the
// generic note, or the server's own message for a 403; the booking is still there and the dialog stays open.
export function cancelFailure(error) {
  if (error.status === 404) return 'This booking is no longer in your list.';
  if (error.status === 422) return sentence(error.message);
  if (error.status === 403) return error.message;
  return GENERIC;
}
