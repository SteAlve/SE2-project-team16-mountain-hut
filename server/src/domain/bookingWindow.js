// When a hiker can still book (MH-01): up to 2 hours before the meal starts, that moment included.
// The times arrive as parameters: domain/ never reads the clock.
export const BOOKING_CLOSES_BEFORE_MS = 2 * 60 * 60 * 1000;

// The last instant a booking is accepted, in milliseconds since 1970.
export const bookingClosesAt = (mealStartsAt) => mealStartsAt.getTime() - BOOKING_CLOSES_BEFORE_MS;

export const isBookingOpen = (mealStartsAt, now) => now.getTime() <= bookingClosesAt(mealStartsAt);
