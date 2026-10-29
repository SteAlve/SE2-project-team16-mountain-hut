// When a hiker can still book (MH-01): up to 2 hours before the meal starts, that moment included.
// Both times arrive as parameters: domain/ never reads the clock.
export const BOOKING_CLOSES_BEFORE_MS = 2 * 60 * 60 * 1000;

export const isBookingOpen = (mealStartsAt, now) =>
  mealStartsAt.getTime() - now.getTime() >= BOOKING_CLOSES_BEFORE_MS;
