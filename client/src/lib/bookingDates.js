/**
 * LIB: the days and times of the booking page, as the hiker reads them.
 * Days are 'YYYY-MM-DD' strings and times 'HH:MM' (the server may add ':SS'), in the hut's time.
 */

// Shown to the hiker only: the server decides whether a booking is still open.
export const BOOKING_CLOSES_BEFORE_MS = 2 * 60 * 60 * 1000;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LONG_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n) => String(n).padStart(2, '0');

const parseDay = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const toDay = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// The `count` days starting from the day of `from`.
export const nextDays = (from, count) =>
  Array.from({ length: count }, (_, i) => toDay(new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)));

// { weekday: 'Sat', day: '17', month: 'Jul' }, for the day strip.
export const dayParts = (day) => {
  const date = parseDay(day);
  return { weekday: WEEKDAYS[date.getDay()], day: String(date.getDate()), month: MONTHS[date.getMonth()] };
};

// 'Sat 17 Jul'
export const formatDay = (day) => {
  const { weekday, day: d, month } = dayParts(day);
  return `${weekday} ${d} ${month}`;
};

// 'Saturday 17 July 2027'
export const formatLongDay = (day) => {
  const date = parseDay(day);
  return `${LONG_WEEKDAYS[date.getDay()]} ${date.getDate()} ${LONG_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

export const yearOf = (day) => day.slice(0, 4);

// '12:00:00' -> '12:00'
export const formatTime = (time) => time.slice(0, 5);

// '12:00 – 13:00'
export const formatTimeRange = (startsAt, endsAt) => `${formatTime(startsAt)} – ${formatTime(endsAt)}`;

const timeOfDate = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

// The instant a slot can no longer be booked.
export const closingTime = (day, startsAt) => {
  const [h, m] = startsAt.split(':').map(Number);
  const start = parseDay(day);
  start.setHours(h, m, 0, 0);
  return new Date(start.getTime() - BOOKING_CLOSES_BEFORE_MS);
};

// Exactly 2 hours before is still open.
export const isClosed = (day, startsAt, now) => now.getTime() > closingTime(day, startsAt).getTime();

// '10:00', for "Closed at 10:00".
export const formatClosingTime = (day, startsAt) => timeOfDate(closingTime(day, startsAt));

// '17:00 today' or '11:00 on Sat 17 Jul', for "You can book this time until ...".
export const formatBookUntil = (day, startsAt, now) => {
  const closes = closingTime(day, startsAt);
  const closesDay = toDay(closes);
  return closesDay === toDay(now)
    ? `${timeOfDate(closes)} today`
    : `${timeOfDate(closes)} on ${formatDay(closesDay)}`;
};
