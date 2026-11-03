/**
 * LIB (temporary): sample data of the "Slots & tables" page, until it is wired to
 * GET /api/staff/table-sets and GET /api/staff/slots. Same shapes as TableSet and StaffSlot in
 * docs/openapi.json. Built from today, so every case of the mockup is always there:
 *   today            lunch 12:00 and 13:00, dinner 19:00
 *   today + 1        no slots
 *   today + 2        13:00 has no tables yet (0 seats, "Choose tables")
 *   other days       lunch and dinner, with different table sets
 */

const pad = (n) => String(n).padStart(2, '0');
const dayFromToday = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const tables = (...capacities) => capacities.map((capacity, i) => ({ tableNumber: i + 1, capacity }));
const tableSet = (tableSetId, name, list) => ({
  tableSetId,
  name,
  tables: list,
  totalSeats: list.reduce((sum, t) => sum + t.capacity, 0),
});

export const MOCK_TABLE_SETS = [
  tableSet(1, 'Lunch, main room', tables(2, 2, 4, 2, 4)),
  tableSet(2, 'Lunch, with the terrace', tables(2, 2, 4, 2, 4, 6, 6)),
  tableSet(3, 'Dinner, main room', tables(4, 4, 6, 2, 6)),
];

const [lunch, terrace, dinner] = MOCK_TABLE_SETS;

const DAYS = 21;

export const MOCK_SLOTS = Array.from({ length: DAYS }, (_, offset) => dayFromToday(offset)).flatMap((date, offset) => {
  if (offset === 1) return [];
  const lunchSet = offset % 3 === 0 ? lunch : terrace;
  return [
    { startsAt: '12:00', endsAt: '13:00', tableSet: lunchSet },
    { startsAt: '13:00', endsAt: '14:00', tableSet: offset === 2 ? null : lunch },
    { startsAt: '19:00', endsAt: '21:00', tableSet: dinner },
  ].map((slot, i) => ({
    slotId: offset * 3 + i + 1,
    date,
    ...slot,
    totalSeats: slot.tableSet?.totalSeats ?? 0,
  }));
});
