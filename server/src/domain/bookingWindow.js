// When a hiker can still book (MH-01): up to 2 hours before the meal starts, that moment included.
// The times arrive as parameters: domain/ never reads the clock.
const BOOKING_CLOSES_BEFORE_MS = 2 * 60 * 60 * 1000;

// The last instant a booking is accepted, in milliseconds since 1970.
export const bookingClosesAt = (mealStartsAt) => mealStartsAt.getTime() - BOOKING_CLOSES_BEFORE_MS;

export const isBookingOpen = (mealStartsAt, now) => now.getTime() <= bookingClosesAt(mealStartsAt);

// When the staff can still enter a reservation for a hiker (MH-07): until the meal starts. The
// 2-hour rule of the hikers does not apply to them. The start instant itself is included, in the
// same way as the 2-hour limit of the hikers includes its own instant; whether the exact start is
// still allowed is not decided by the product owner yet.
export const isOpenForStaff = (mealStartsAt, now) => now.getTime() <= mealStartsAt.getTime();
