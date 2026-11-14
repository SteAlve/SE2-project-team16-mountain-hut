// When a hiker can still book (MH-01): up to 2 hours before the meal starts, that moment included.
// When a hiker can still change a booking (MH-06): at least 48 hours must remain before the meal
// starts, with the exact 48-hour boundary included. When moving to another slot, this applies to
// both the original and destination slots, as confirmed by the product owner in issue #43:
// https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/43
// The times arrive as parameters: domain/ never reads the clock.
const HOUR_MS = 60 * 60 * 1000;
const BOOKING_CLOSES_BEFORE_MS = 2 * HOUR_MS;
const CHANGES_CLOSE_BEFORE_MS = 48 * HOUR_MS;

// The last instant a booking is accepted, in milliseconds since 1970.
export const bookingClosesAt = (mealStartsAt) => mealStartsAt.getTime() - BOOKING_CLOSES_BEFORE_MS;

export const isBookingOpen = (mealStartsAt, now) => now.getTime() <= bookingClosesAt(mealStartsAt);

// When the staff can still enter a reservation for a hiker (MH-07): until the meal starts. The
// 2-hour rule of the hikers does not apply to them. The start instant itself is included, in the
// same way as the 2-hour limit of the hikers includes its own instant; whether the exact start is
// still allowed is not decided by the product owner yet.
export const isOpenForStaff = (mealStartsAt, now) => now.getTime() <= mealStartsAt.getTime();

// The last instant a booking for this meal can be changed, in milliseconds since 1970.
export const changesCloseAt = (mealStartsAt) => mealStartsAt.getTime() - CHANGES_CLOSE_BEFORE_MS;

export const isChangeOpen = (mealStartsAt, now) => now.getTime() <= changesCloseAt(mealStartsAt);
