/**
 * DTO of slots and bookings: validates the body of POST /api/bookings (with the dietary
 * requirements of the party, MH-05) and the parameters of the seating preview (wrong input throws a ValidationError, 400) and shapes what goes out.
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

const MAX_OTHER_LENGTH = 100;
const MAX_REQUESTS_LENGTH = 300;

// A list of codes (the diets or the allergies of a line): optional, text, each once.
const requireCodes = (value, field) => {
  const codes = value ?? [];
  if (!Array.isArray(codes) || codes.some((code) => typeof code !== 'string')) {
    throw new ValidationError(`${field} must be an array of text`);
  }
  if (new Set(codes).size !== codes.length) {
    throw new ValidationError(`The same value can appear only once in ${field}`);
  }
  return codes;
};

// An optional text of a line, trimmed: null when it is not sent, never empty when it is.
const optionalText = (value, field, maxLength) => {
  if (value === undefined || value === null) return null;
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '') throw new ValidationError(`${field} cannot be empty`);
  if (text.length > maxLength) throw new ValidationError(`${field} can be at most ${maxLength} characters`);
  return text;
};

// One guest line of the dietary needs (MH-05): diets and allergies from the preset lists, an
// "other" diet and an "other" allergy in words, and other requests for the kitchen. At least one of
// them. hasAllergies is not sent: the server works it out. Which diets and allergies exist, and
// which diets go together, are rules of the hut (domain/dietaryNeeds.js).
const requireRequirement = (item) => {
  requireObject(item, 'Each requirement must be an object');
  rejectUnknownFields(item, ['diets', 'otherDiet', 'allergies', 'otherAllergy', 'otherRequests'], ' in requirements');

  const line = {
    diets: requireCodes(item.diets, 'diets'),
    otherDiet: optionalText(item.otherDiet, 'otherDiet', MAX_OTHER_LENGTH),
    allergies: requireCodes(item.allergies, 'allergies'),
    otherAllergy: optionalText(item.otherAllergy, 'otherAllergy', MAX_OTHER_LENGTH),
    otherRequests: optionalText(item.otherRequests, 'otherRequests', MAX_REQUESTS_LENGTH),
  };
  const empty = line.diets.length === 0 && line.allergies.length === 0
    && line.otherDiet === null && line.otherAllergy === null && line.otherRequests === null;
  if (empty) throw new ValidationError('Each requirement needs a diet, an allergy or a request');
  return line;
};

// The dietary needs of the party (MH-05): optional, one line per guest who has any, so there are
// at most as many lines as people.
const requireRequirements = (value, partySize) => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new ValidationError('requirements must be an array');
  if (value.length > partySize) {
    throw new ValidationError('There can be at most one requirement per person of the party');
  }
  return value.map(requireRequirement);
};

// Body of POST /api/bookings: the tables are the ones the seating preview showed.
export function parseCreateBooking(body) {
  requireObject(body);
  rejectUnknownFields(body, ['slotId', 'partySize', 'tables', 'requirements']);

  const partySize = requirePositiveInteger(body.partySize, 'partySize');
  return {
    slotId: requirePositiveInteger(body.slotId, 'slotId'),
    partySize,
    tables: requireTables(body.tables, partySize),
    requirements: requireRequirements(body.requirements, partySize),
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

const toRequirementsDto = (requirements = []) => requirements.map(
  ({ diets, otherDiet, allergies, otherAllergy, otherRequests, hasAllergies }) => ({
    diets, otherDiet, allergies, otherAllergy, otherRequests, hasAllergies,
  }),
);

export const toBookingDto = ({ id, date, slotId, partySize, tables, requirements }) => ({
  id,
  date,
  slotId,
  partySize,
  tables: toTablesDto(tables),
  requirements: toRequirementsDto(requirements),
});
