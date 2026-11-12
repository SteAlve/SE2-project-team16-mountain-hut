/**
 * Use case: change a booking (changeBooking) and send the hiker the new details by email (MH-06).
 *
 * The email says that the booking changed and that it replaces the earlier emails of the same
 * booking reference, with the moment of the change, so two emails of one reference are never
 * confused. As for a new booking, a failed email is only written to the log: the change stands.
 */
import { bookingChangedEmail } from '../domain/bookingConfirmation.js';

export const makeChangeBookingAndNotify = ({ changeBooking, bookings, mailer, clock, hutTimeZone }) =>
  async (input) => {
    const booking = await changeBooking(input);

    try {
      // Only the hiker's name and address are read again; the booking itself is the one saved by the
      // change, so the email never mixes it with a later change.
      const { email, firstName, lastName } = await bookings.findConfirmationDetails(booking.id);
      const { id: bookingId, date, startsAt, endsAt, partySize, requirements } = booking;
      const changedAt = clock.localDateTime(clock.now().getTime(), hutTimeZone);
      await mailer.send(bookingChangedEmail({
        email, firstName, lastName, bookingId, date, startsAt, endsAt, partySize, requirements, changedAt,
      }));
    } catch (error) {
      console.error(`The email about the change of booking ${booking.id} was not sent:`, error);
    }

    return booking;
  };
