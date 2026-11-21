/**
 * Use case: a hiker cancels their booking (MH-08), so the hut can give the seats to other guests.
 *
 * Rules:
 *   - only the hiker who made the booking can cancel it (another booking answers 404, as if it did
 *     not exist, as for a change);
 *   - there is no time limit: a hiker can cancel at any time (product owner, MH-08);
 *   - a booking is cancelled once: a second cancellation answers 422.
 *
 * Errors: 403 not a hiker; 404 the booking does not exist or is not of this hiker; 422 the booking
 * was already cancelled.
 */
import { ForbiddenError, NotFoundError, UnprocessableError } from '../domain/errors.js';
import { ROLES } from '../domain/roles.js';

const alreadyCancelled = () => new UnprocessableError('This booking was already cancelled');

export const makeCancelBooking = ({ bookings, clock }) => async ({ user, bookingId }) => {
  if (user.role !== ROLES.HIKER) throw new ForbiddenError('Only hikers can cancel bookings');

  const booking = await bookings.findById(bookingId);
  if (!booking || booking.hikerId !== user.id) throw new NotFoundError(`Booking ${bookingId} not found`);
  if (booking.cancelled) throw alreadyCancelled();

  const cancelledAt = clock.now();
  try {
    await bookings.cancelBooking({ bookingId, cancelledAt });
  } catch (error) {
    // The dao checks again with the row locked: another cancellation may have been saved just now.
    if (error.code === 'BOOKING_NOT_FOUND') throw alreadyCancelled();
    throw error;
  }
  return { bookingId, cancelledAt };
};
