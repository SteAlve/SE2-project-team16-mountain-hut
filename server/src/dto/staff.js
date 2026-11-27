/**
 * DTO of the staff endpoints: the table sets and the slots (MH-02) and the hikers the staff
 * reserves for (MH-07). It validates what comes in (wrong input throws a ValidationError, 400) and
 * shapes what goes out.
 */
import { ValidationError } from '../domain/errors.js';
import {
  optionalPhone,
  rejectUnknownFields,
  requireDate,
  requireEmail,
  requireObject,
  requirePositiveInteger,
  requirePositiveIntegerText,
  requireText,
  requireTime,
  toHourMinute,
} from './fields.js';

const requireTables = (value) => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError('tables must be a non-empty array');
  }
  const tables = value.map((item) => {
    requireObject(item, 'Each table must be an object');
    rejectUnknownFields(item, ['tableNumber', 'capacity'], ' in tables');
    return {
      tableNumber: requirePositiveInteger(item.tableNumber, 'tableNumber'),
      capacity: requirePositiveInteger(item.capacity, 'capacity'),
    };
  });
  if (new Set(tables.map((table) => table.tableNumber)).size !== tables.length) {
    throw new ValidationError('tableNumber values must be unique');
  }
  return tables;
};

// POST /api/staff/table-sets
export function parseCreateTableSet(body) {
  requireObject(body);
  rejectUnknownFields(body, ['name', 'tables']);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name === '') throw new ValidationError('name is required');
  return { name, tables: requireTables(body.tables) };
}

// POST /api/staff/slots. tableSetId is optional: without it the slot has no seats yet.
export function parseCreateSlot(body) {
  requireObject(body);
  rejectUnknownFields(body, ['date', 'startsAt', 'endsAt', 'tableSetId']);
  const slot = {
    date: requireDate(body.date, 'date'),
    startsAt: requireTime(body.startsAt, 'startsAt'),
    endsAt: requireTime(body.endsAt, 'endsAt'),
  };
  // 'HH:MM' texts compare like the times they are
  if (slot.endsAt <= slot.startsAt) throw new ValidationError('endsAt must be after startsAt');
  if (body.tableSetId === undefined || body.tableSetId === null) return slot;
  return { ...slot, tableSetId: requirePositiveInteger(body.tableSetId, 'tableSetId') };
}

// GET /api/staff/slots?from=2026-10-01&to=2026-10-31
export function parseListStaffSlots(query) {
  const from = requireDate(query?.from, 'from');
  const to = requireDate(query?.to, 'to');
  if (to < from) throw new ValidationError('to must not be before from');
  return { from, to };
}

const daysBetween = (from, to) => {
  const toUtcDay = (date) => {
    const [year, month, day] = date.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtcDay(to) - toUtcDay(from)) / (24 * 60 * 60 * 1000));
};

// GET /api/staff/slots/weeks?from=2026-10-01&to=2026-10-28. The range contains complete
// seven-day periods starting at from.
export function parseListStaffPeriodSummaries(query) {
  const from = requireDate(query?.from, 'from');
  const to = requireDate(query?.to, 'to');
  const days = daysBetween(from, to);
  if (to < from) throw new ValidationError('to must not be before from');
  if ((days + 1) % 7 !== 0) {
    throw new ValidationError('from and to must delimit complete seven-day periods');
  }
  return { from, to };
}

// PUT /api/staff/slots/:slotId/table-set
export function parseAssignTableSet(params, body) {
  const slotId = requirePositiveIntegerText(params?.slotId, 'slotId');
  requireObject(body);
  rejectUnknownFields(body, ['tableSetId']);
  return { slotId, tableSetId: requirePositiveInteger(body.tableSetId, 'tableSetId') };
}

// POST /api/staff/slots/copy-week. Each destination interval must contain one or more whole
// seven-day periods; the DAO repeats the source schedule in every seven-day period.
export function parseCopyWeekSchedule(body) {
  requireObject(body);
  rejectUnknownFields(body, ['sourceStart', 'destinationIntervals']);
  if (!Array.isArray(body.destinationIntervals) || body.destinationIntervals.length === 0) {
    throw new ValidationError('destinationIntervals must be a non-empty array');
  }
  return {
    sourceStart: requireDate(body.sourceStart, 'sourceStart'),
    destinationIntervals: body.destinationIntervals.map((interval) => {
      requireObject(interval, 'Each destination interval must be an object');
      rejectUnknownFields(interval, ['from', 'to'], ' in destinationIntervals');
      return {
        from: requireDate(interval.from, 'from'),
        to: requireDate(interval.to, 'to'),
      };
    }),
  };
}

// GET /api/staff/hikers?q=rossi. The text must be there; whether it is long enough is a rule of the
// use case.
export function parseSearchHikers(query) {
  const text = query?.q;
  if (typeof text !== 'string') throw new ValidationError('q is required');
  return { text };
}

// POST /api/staff/hikers. With an email the hiker gets an account, without it the hiker is
// temporary: email is null in that case, and phone is null when it is not given.
export function parseCreateHiker(body) {
  requireObject(body);
  rejectUnknownFields(body, ['firstName', 'lastName', 'email', 'phone']);
  return {
    firstName: requireText(body, 'firstName'),
    lastName: requireText(body, 'lastName'),
    email: body.email === undefined || body.email === null ? null : requireEmail(body),
    phone: optionalPhone(body),
  };
}

export const toTableSetDto = ({ tableSetId, name, tables, totalSeats }) => ({
  tableSetId,
  name,
  tables: tables.map(({ tableNumber, capacity }) => ({ tableNumber, capacity })),
  totalSeats,
});

export const toStaffSlotDto = ({ slotId, date, startsAt, endsAt, tableSet, totalSeats }) => ({
  slotId,
  date,
  startsAt: toHourMinute(startsAt),
  endsAt: toHourMinute(endsAt),
  tableSet: tableSet === null ? null : toTableSetDto(tableSet),
  totalSeats,
});

// A hiker as the staff sees one (MH-07). `temporary` says that there is no account behind it.
export const toHikerDto = ({ id, firstName, lastName, email, phone, temporary }) => ({
  id,
  firstName,
  lastName,
  email,
  phone,
  temporary,
});
