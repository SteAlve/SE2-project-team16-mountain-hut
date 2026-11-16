/**
 * Use case: the bookings of the logged-in hiker from today on (MH-06, the page "My bookings"), in
 * order of day and time. "Today" is the day of the hut, so today's meals are listed even when they
 * have started. Cancelled bookings are left out. For each booking:
 *   canChange          true while the booking can still be changed (until 48 hours before the meal)
 *   changeableUntil    when changes close, as the local date and time of the hut: 'YYYY-MM-DDTHH:MM'
 *
 * Errors: 403 the user is not a hiker.
 */
import { changesCloseAt, isChangeOpen } from '../domain/bookingWindow.js';
import { ForbiddenError } from '../domain/errors.js';
import { ROLES } from '../domain/roles.js';

export const makeListMyBookings = ({ bookings, clock, hutTimeZone }) => async ({ user }) => {
  if (user.role !== ROLES.HIKER) throw new ForbiddenError('Only hikers have bookings');

  const now = clock.now();
  const rows = await bookings.findUpcomingByHiker(user.id, clock.today(hutTimeZone));

  return rows.map((booking) => {
    const mealStartsAt = clock.at(booking.date, booking.startsAt, hutTimeZone);
    return {
      ...booking,
      canChange: isChangeOpen(mealStartsAt, now),
      changeableUntil: clock.localDateTime(changesCloseAt(mealStartsAt), hutTimeZone),
    };
  });
};
