/**
 * DTO of slots and bookings: validates the query of GET /api/slots and the body of
 * POST /api/bookings (wrong input throws a ValidationError, 400) and shapes what goes out.
 */
import { ValidationError } from '../domain/errors.js';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

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

export const parseSlotsQuery = (query) => ({ date: requireDate(query?.date) });

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

// '12:00:00' -> '12:00'
const toHourMinute = (time) => time.slice(0, 5);

export const toBookableSlotDto = ({ slotId, startsAt, endsAt, freeSeats }) => ({
  slotId,
  startsAt: toHourMinute(startsAt),
  endsAt: toHourMinute(endsAt),
  freeSeats,
});

export const toBookingDto = ({ id, date, slotId, partySize }) => ({ id, date, slotId, partySize });
