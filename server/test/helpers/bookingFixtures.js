// Test data for the booking tests: a table set, its tables and a slot, on a far-future date.
// Everything created here has a name starting with "test-" and is removed by cleanBookingData().
import { randomUUID } from 'node:crypto';
import { get, run } from '../../src/dao/db.js';

let counter = 0;

// A different date each time (2090), so two slots never meet on (date, start time).
const nextDate = () => {
  counter += 1;
  const month = String(1 + (Math.floor(counter / 28) % 12)).padStart(2, '0');
  const day = String(1 + (counter % 28)).padStart(2, '0');
  return `2090-${month}-${day}`;
};

export async function createSlot({ date = nextDate(), startsAt = '12:00', endsAt = '13:00', seats = [4, 4, 2] } = {}) {
  const set = await get('INSERT INTO table_set (name) VALUES ($1) RETURNING id', [`test-${randomUUID()}`]);
  const tableIds = [];
  for (const [index, capacity] of seats.entries()) {
    const table = await get(
      'INSERT INTO hut_table (table_set_id, table_number, seat_capacity) VALUES ($1, $2, $3) RETURNING id',
      [set.id, index + 1, capacity],
    );
    tableIds.push(table.id);
  }
  const slot = await get(
    'INSERT INTO slot (service_date, starts_at, ends_at, table_set_id) VALUES ($1, $2, $3, $4) RETURNING id',
    [date, startsAt, endsAt, set.id],
  );
  return { slotId: slot.id, tableSetId: set.id, tableIds, date };
}

export async function createSlotWithoutTableSet(date = nextDate(), startsAt = '18:00', endsAt = '19:00') {
  const slot = await get(
    'INSERT INTO slot (service_date, starts_at, ends_at) VALUES ($1, $2, $3) RETURNING id',
    [date, startsAt, endsAt],
  );
  return { slotId: slot.id, date };
}

export async function cleanBookingData() {
  const testSets = "SELECT id FROM table_set WHERE name LIKE 'test-%'";
  await run(`DELETE FROM booking WHERE table_set_id IN (${testSets}) OR slot_id IN (SELECT id FROM slot WHERE table_set_id IS NULL AND service_date >= '2090-01-01')`);
  await run(`DELETE FROM slot WHERE table_set_id IN (${testSets}) OR (table_set_id IS NULL AND service_date >= '2090-01-01')`);
  await run(`DELETE FROM hut_table WHERE table_set_id IN (${testSets})`);
  await run("DELETE FROM table_set WHERE name LIKE 'test-%'");
}

export async function createHiker(email) {
  return get(
    `INSERT INTO app_user (first_name, last_name, email, role, password_hash)
     VALUES ('Test', 'Hiker', $1, 'HIKER', 'x') RETURNING id`,
    [email],
  );
}
