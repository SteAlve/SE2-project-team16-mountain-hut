/**
 * Use case: cancel a booking (cancelBooking) and send the hiker a confirmation by email (MH-08).
 *
 * The email has the details of the booking that was cancelled and the moment of the cancellation.
 * They are read after it: a cancelled booking cannot change any more, so they are the details it had
 * when it was cancelled. As for a new booking, a failed email is only written to the log: the
 * cancellation stands. A temporary hiker has no email, so nothing is sent for them.
 */
import { bookingCancelledEmail } from '../domain/bookingConfirmation.js';

export const makeCancelBookingAndNotify = ({ cancelBooking, bookings, mailer, clock, hutTimeZone }) =>
  async (input) => {
    const cancellation = await cancelBooking(input);

    try {
      const details = await bookings.findConfirmationDetails(cancellation.bookingId);
      if (details.email !== null) {
        const cancelledAt = clock.localDateTime(cancellation.cancelledAt.getTime(), hutTimeZone);
        await mailer.send(bookingCancelledEmail({ ...details, cancelledAt }));
      }
    } catch (error) {
      console.error(`The email about the cancellation of booking ${cancellation.bookingId} was not sent:`, error);
    }

    return cancellation;
  };
