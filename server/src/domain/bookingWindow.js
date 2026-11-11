// When a hiker can still book (MH-01): up to 2 hours before the meal starts, that moment included.
// When a hiker can still change a booking (MH-06): up to 48 hours before the meal starts, that moment
// included. The team reads "within 48 hours from the date booked" as "until 48 hours before the
// meal" (team decision of 10 Nov 2026, not asked to the product owner).
// The times arrive as parameters: domain/ never reads the clock.
const HOUR_MS = 60 * 60 * 1000;
const BOOKING_CLOSES_BEFORE_MS = 2 * HOUR_MS;
const CHANGES_CLOSE_BEFORE_MS = 48 * HOUR_MS;

// The last instant a booking is accepted, in milliseconds since 1970.
export const bookingClosesAt = (mealStartsAt) => mealStartsAt.getTime() - BOOKING_CLOSES_BEFORE_MS;

export const isBookingOpen = (mealStartsAt, now) => now.getTime() <= bookingClosesAt(mealStartsAt);

// The last instant a booking for this meal can be changed, in milliseconds since 1970.
export const changesCloseAt = (mealStartsAt) => mealStartsAt.getTime() - CHANGES_CLOSE_BEFORE_MS;

export const isChangeOpen = (mealStartsAt, now) => now.getTime() <= changesCloseAt(mealStartsAt);
