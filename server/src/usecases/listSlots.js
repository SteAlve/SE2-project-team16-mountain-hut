/**
 * Use case: every slot from today on, for the booking page. Public.
 * "Today" is the day in the time zone of the hut. A slot is listed even if it is full, has no tables
 * (0 free seats) or is already closed: the page shows it greyed, with the reason. For each slot:
 *   bookingOpen       true while a hiker can still book it (until 2 hours before the meal)
 *   bookingClosesAt   when booking closes, as the local date and time of the hut: 'YYYY-MM-DDTHH:MM'
 * The page decides if the party fits by comparing it with freeSeats: a party is split over tables
 * when it has to, so any party up to the free seats can sit.
 */
import { bookingClosesAt, isBookingOpen } from '../domain/bookingWindow.js';

export const makeListSlots = ({ slots, clock, hutTimeZone }) => async () => {
  const now = clock.now();
  const rows = await slots.findFromDate(clock.today(hutTimeZone));

  return rows.map(({ slotId, date, startsAt, endsAt, freeSeats }) => {
    const mealStartsAt = clock.at(date, startsAt, hutTimeZone);
    return {
      slotId,
      date,
      startsAt,
      endsAt,
      freeSeats,
      bookingOpen: isBookingOpen(mealStartsAt, now),
      bookingClosesAt: clock.localDateTime(bookingClosesAt(mealStartsAt), hutTimeZone),
    };
  });
};
