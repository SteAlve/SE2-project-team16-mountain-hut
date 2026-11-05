/**
 * LIB: the table sets and the slots of the staff page "Slots & tables" (story MH-02,
 * mockup docs/mockups/slots). Tables are { tableNumber, capacity }, as in docs/openapi.json.
 * The checks are the ones of the mockup ("Fields and rules"); the server checks them again.
 */

export const totalSeats = (tables) => tables.reduce((sum, t) => sum + t.capacity, 0);

// '1 seat', '14 seats'
export const seatsLabel = (n) => `${n} ${n === 1 ? 'seat' : 'seats'}`;

// '5 tables · 14 seats'
export const tablesLabel = (tables) =>
  `${tables.length} ${tables.length === 1 ? 'table' : 'tables'} · ${seatsLabel(totalSeats(tables))}`;

// '3 × 2 seats · 2 × 4 · 1 × 6': how many tables of each size, smallest first.
export const bySize = (tables) => {
  const counts = new Map();
  for (const t of [...tables].sort((a, b) => a.capacity - b.capacity)) {
    counts.set(t.capacity, (counts.get(t.capacity) ?? 0) + 1);
  }
  return [...counts].map(([capacity, count], i) => `${count} × ${capacity}${i === 0 ? ' seats' : ''}`).join(' · ');
};

// The number the empty last cell offers: one more than the biggest.
export const nextTableNumber = (tables) =>
  tables.reduce((max, t) => Math.max(max, Number(t.tableNumber) || 0), 0) + 1;

const minutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

// '1 h', '1 h 30', '45 min'
export const durationLabel = (startsAt, endsAt) => {
  const length = minutes(endsAt) - minutes(startsAt);
  const h = Math.floor(length / 60);
  const m = length % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
};

export const byStart = (a, b) => a.startsAt.localeCompare(b.startsAt);

const isTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value ?? '');
const isDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') && !Number.isNaN(new Date(value).getTime());
const isPositiveInt = (value) => /^\d+$/.test(String(value).trim()) && Number(value) >= 1;

// { date?, startsAt?, endsAt? }: the message of each wrong field, empty when the slot can be sent.
export function validateSlot({ date, startsAt, endsAt }) {
  const errors = {};
  if (!isDay(date)) errors.date = 'Choose a day.';
  if (!isTime(startsAt)) errors.startsAt = 'Enter the start time.';
  if (!isTime(endsAt)) errors.endsAt = 'Enter the end time.';
  else if (isTime(startsAt) && minutes(endsAt) <= minutes(startsAt)) {
    errors.endsAt = 'The slot must end after it starts.';
  }
  return errors;
}

// `tables` are the rows of the form, numbers still as typed: [{ tableNumber, capacity }].
// Returns { name?, tables?, rows: { [index]: { tableNumber?, capacity? } } }.
export function validateTableSet({ name, tables }) {
  const errors = { rows: {} };
  if (!name.trim()) errors.name = 'Enter a name for the set.';
  if (tables.length === 0) errors.tables = 'Add at least one table.';
  const seen = new Set();
  tables.forEach((t, i) => {
    const row = {};
    if (!isPositiveInt(t.tableNumber)) row.tableNumber = 'A whole number from 1.';
    else if (seen.has(Number(t.tableNumber))) row.tableNumber = 'Already used by another table.';
    else seen.add(Number(t.tableNumber));
    if (!isPositiveInt(t.capacity)) row.capacity = 'At least 1 seat.';
    if (row.tableNumber || row.capacity) errors.rows[i] = row;
  });
  return errors;
}

export const hasErrors = (errors) =>
  Object.keys(errors).some((key) => key !== 'rows') || Object.keys(errors.rows ?? {}).length > 0;
