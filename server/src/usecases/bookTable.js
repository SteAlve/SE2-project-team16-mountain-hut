/**
 * Use case: book a table (createBooking) and tell the hiker by email (MH-03), with the dietary needs
 * just saved (MH-05).
 *
 * It wraps any use case that books: createBooking, when a hiker books for themselves, and
 * createStaffBooking, when the staff books for a hiker (MH-07). A temporary hiker has no email, so
 * nothing is sent for them.
 *
 * The email leaves after the booking is saved. If it fails the booking still stands: the failure
 * is only written to the log, and the answer is the same as usual.
 */
import { bookingConfirmationEmail } from '../domain/bookingConfirmation.js';

export const makeBookTable = ({ createBooking, bookings, mailer }) => async (input) => {
  const booking = await createBooking(input);

  try {
    const details = await bookings.findConfirmationDetails(booking.id);
    if (details.email !== null) {
      await mailer.send(bookingConfirmationEmail({ ...details, requirements: booking.requirements }));
    }
  } catch (error) {
    console.error(`The confirmation email of booking ${booking.id} was not sent:`, error);
  }

  return booking;
};
