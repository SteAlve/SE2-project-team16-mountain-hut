/**
 * DTO of slots and bookings: validates the body of POST /api/bookings and the parameters of the
 * seating preview (wrong input throws a ValidationError, 400) and shapes what goes out.
 */
import { ValidationError } from '../domain/errors.js';
import {
  rejectUnknownFields,
  requireObject,
  requirePositiveInteger,
  requirePositiveIntegerText,
  toHourMinute,
} from './fields.js';

const requireTables = (value, partySize) => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError('tables must be a non-empty array');
  }
  const seen = new Set();
  let seats = 0;
  for (const item of value) {
    requireObject(item, 'Each table must be an object');
    rejectUnknownFields(item, ['tableNumber', 'seats'], ' in tables');
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
  requireObject(body);
  rejectUnknownFields(body, ['slotId', 'partySize', 'tables']);

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
