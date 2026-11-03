/**
 * DTO of the staff endpoints (MH-02): validates what comes in (wrong input throws a ValidationError,
 * 400) and shapes what goes out.
 */
import { ValidationError } from '../domain/errors.js';
import {
  rejectUnknownFields,
  requireDate,
  requireObject,
  requirePositiveInteger,
  requirePositiveIntegerText,
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

// PUT /api/staff/slots/:slotId/table-set
export function parseAssignTableSet(params, body) {
  const slotId = requirePositiveIntegerText(params?.slotId, 'slotId');
  requireObject(body);
  rejectUnknownFields(body, ['tableSetId']);
  return { slotId, tableSetId: requirePositiveInteger(body.tableSetId, 'tableSetId') };
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
