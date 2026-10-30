/**
 * DTO of slots and bookings: validates the body of POST /api/bookings and the parameters of the
 * seating preview (wrong input throws a ValidationError, 400) and shapes what goes out.
 */
import { ValidationError } from '../domain/errors.js';

const POSITIVE_INTEGER_TEXT = /^[1-9]\d*$/;

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

const requireTables = (value, partySize) => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError('tables must be a non-empty array');
  }
  const seen = new Set();
  let seats = 0;
  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new ValidationError('Each table must be an object');
    }
    const unknown = Object.keys(item).filter((key) => !['tableNumber', 'seats'].includes(key));
    if (unknown.length > 0) throw new ValidationError(`Unknown field in tables: ${unknown[0]}`);
    const tableNumber = requirePositiveInteger(item.tableNumber, 'tableNumber');
    if (seen.has(tableNumber)) throw new ValidationError('A table can appear only once in tables');
    seen.add(tableNumber);
    seats += requirePositiveInteger(item.seats, 'seats');
  }
  if (seats !== partySize) throw new ValidationError('The seats of the tables must add up to partySize');
  return value.map(({ tableNumber, seats: tableSeats }) => ({ tableNumber, seats: tableSeats }));
};

// Body of POST /api/bookings: the tables are the ones the seating preview showed.
export function parseCreateBooking(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object');
  }
  const unknown = Object.keys(body).filter((key) => !['slotId', 'partySize', 'tables'].includes(key));
  if (unknown.length > 0) throw new ValidationError(`Unknown field: ${unknown[0]}`);

  const partySize = requirePositiveInteger(body.partySize, 'partySize');
  return {
    slotId: requirePositiveInteger(body.slotId, 'slotId'),
    partySize,
    tables: requireTables(body.tables, partySize),
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
