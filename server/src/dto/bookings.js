/**
 * DTO of slots and bookings: validates the body of POST /api/bookings and the parameters of the
 * seating preview (wrong input throws a ValidationError, 400) and shapes what goes out.
 */
import { ValidationError } from '../domain/errors.js';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const POSITIVE_INTEGER_TEXT = /^[1-9]\d*$/;

const isCalendarDate = (value) => {
  const match = typeof value === 'string' ? DATE_PATTERN.exec(value) : null;
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
};

const requireDate = (value) => {
  if (!isCalendarDate(value)) throw new ValidationError('date must be a valid date');
  return value;
};

const requirePositiveInteger = (value, field) => {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new ValidationError(`${field} must be a positive integer`);
  }
  return value;
};

// A value of the URL (a path parameter or a query string value) is text.
const requirePositiveIntegerText = (value, field) => {
  if (typeof value !== 'string' || !POSITIVE_INTEGER_TEXT.test(value)) {
    throw new ValidationError(`${field} must be a positive integer`);
  }
  return requirePositiveInteger(Number(value), field);
};

export function parseCreateBooking(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object');
  }
  const unknown = Object.keys(body).filter((key) => !['date', 'slotId', 'partySize'].includes(key));
  if (unknown.length > 0) throw new ValidationError(`Unknown field: ${unknown[0]}`);

  return {
    date: requireDate(body.date),
    slotId: requirePositiveInteger(body.slotId, 'slotId'),
    partySize: requirePositiveInteger(body.partySize, 'partySize'),
  };
}

// GET /api/slots/:slotId/seating?partySize=6
export const parseSeatingRequest = (params, query) => ({
  slotId: requirePositiveIntegerText(params?.slotId, 'slotId'),
  partySize: requirePositiveIntegerText(query?.partySize, 'partySize'),
});

// '12:00:00' -> '12:00'
const toHourMinute = (time) => time.slice(0, 5);

export const toSlotDto = ({ slotId, date, startsAt, endsAt, freeSeats, bookingOpen, bookingClosesAt }) => ({
  slotId,
  date,
  startsAt: toHourMinute(startsAt),
  endsAt: toHourMinute(endsAt),
  freeSeats,
  bookingOpen,
  bookingClosesAt,
});

const toTablesDto = (tables) => tables.map(({ tableNumber, seats }) => ({ tableNumber, seats }));

export const toSeatingDto = ({ slotId, partySize, tables }) => ({
  slotId,
  partySize,
  tables: toTablesDto(tables),
});

export const toBookingDto = ({ id, date, slotId, partySize, tables }) => ({
  id,
  date,
  slotId,
  partySize,
  tables: toTablesDto(tables),
});
