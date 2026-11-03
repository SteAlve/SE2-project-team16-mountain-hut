/**
 * SEED: creates the demo hut staff (one warden, two employees) and the demo table sets and meal
 * slots (the next three weeks, counted from the day it runs), so that the app can be tried and demoed without a sign up page for staff.
 * Run it with `npm run db:seed`, after `npm run db:migrate`.
 * It is safe to run again: an account whose email already exists is left untouched, and a slot
 * that already has bookings is not changed.
 *
 * The password below is a DEMO password, published in the README. Do not seed a real hut with it.
 */
import { fileURLToPath } from 'node:url';
import { clock } from '../src/clock.js';
import { config } from '../src/config.js';
import { close, get, inTransaction, run } from '../src/dao/db.js';
import * as users from '../src/dao/users.js';
import { hash } from '../src/passwordHasher.js';

export const DEMO_PASSWORD = 'quota-demo-2026';

export const DEMO_STAFF = [
  { firstName: 'Emily', lastName: 'Parker', email: 'emily.parker@quota.example', role: 'WARDEN' },
  { firstName: 'James', lastName: 'Taylor', email: 'james.taylor@quota.example', role: 'EMPLOYEE' },
  { firstName: 'Oliver', lastName: 'Wilson', email: 'oliver.wilson@quota.example', role: 'EMPLOYEE' },
];

// Demo layouts vary the number and capacity of tables from service to service.
export const DEMO_TABLE_LAYOUTS = [
  { name: 'Demo Compact', tableCapacities: [2, 2, 2, 4, 4, 6] },
  { name: 'Demo Balanced', tableCapacities: [2, 3, 4, 4, 6, 8] },
  { name: 'Demo Mixed', tableCapacities: [2, 3, 4, 5, 6, 7, 8] },
  { name: 'Demo Large Groups', tableCapacities: [4, 6, 6, 8] },
];

// The service days, as a number of days from the day the seed runs (tomorrow is 1).
const DEMO_DAY_OFFSETS = [1, 2, 4, 5, 7, 9, 10, 12, 13, 15, 16, 18, 20, 21];
const DEMO_MEAL_TIMES = [
  { startsAt: '12:00', endsAt: '13:00' },
  { startsAt: '13:00', endsAt: '14:00' },
  { startsAt: '19:00', endsAt: '21:00' },
];

// The demo slots of a run. `today` is 'YYYY-MM-DD', the day of the hut; the days are counted from it.
export const demoSlots = (today) => {
  const [year, month, day] = today.split('-').map(Number);
  return DEMO_DAY_OFFSETS.flatMap((offset) => {
    const serviceDate = new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
    return DEMO_MEAL_TIMES.map((meal, mealIndex) => ({
      serviceDate,
      ...meal,
      tableSetName: DEMO_TABLE_LAYOUTS[(offset + mealIndex) % DEMO_TABLE_LAYOUTS.length].name,
    }));
  });
};

export async function seedStaff() {
  const passwordHash = await hash(DEMO_PASSWORD);
  const created = [];
  for (const staff of DEMO_STAFF) {
    const user = await users.insert({ ...staff, phone: null, passwordHash });
    if (user) created.push(staff.email);
  }
  return created;
}

// `today` is a parameter so that a test can fix it; by default it is today in the time zone of the hut.
export async function seedSlots(today = clock.today(config.hutTimeZone)) {
  return inTransaction(async () => {
    const tableSetIds = new Map();
    let tablesCreated = 0;
    for (const layout of DEMO_TABLE_LAYOUTS) {
      await run('INSERT INTO table_set (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [layout.name]);
      const tableSet = await get('SELECT id FROM table_set WHERE name = $1', [layout.name]);
      tableSetIds.set(layout.name, tableSet.id);

      for (const [index, seatCapacity] of layout.tableCapacities.entries()) {
        const result = await run(
          `INSERT INTO hut_table (table_set_id, table_number, seat_capacity)
           VALUES ($1, $2, $3)
           ON CONFLICT (table_set_id, table_number) DO NOTHING`,
          [tableSet.id, index + 1, seatCapacity],
        );
        tablesCreated += result.rowCount;
      }
    }

    let slotsSeeded = 0;
    for (const slot of demoSlots(today)) {
      const result = await run(
        `INSERT INTO slot AS existing (service_date, starts_at, ends_at, table_set_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (service_date, starts_at) DO UPDATE
         SET ends_at = EXCLUDED.ends_at, table_set_id = EXCLUDED.table_set_id
         WHERE NOT EXISTS (
           SELECT 1 FROM booking WHERE booking.slot_id = existing.id
         )`,
        [slot.serviceDate, slot.startsAt, slot.endsAt, tableSetIds.get(slot.tableSetName)],
      );
      slotsSeeded += result.rowCount;
    }

    return { tablesCreated, slotsSeeded };
  });
}

// Only when started as a script (npm run db:seed), not when imported by the tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const staffCreated = await seedStaff();
    const { tablesCreated, slotsSeeded } = await seedSlots();
    console.log(staffCreated.length > 0 ? `Created staff: ${staffCreated.join(', ')}` : 'Demo staff already present.');
    console.log(`Added ${tablesCreated} demo tables and seeded ${slotsSeeded} demo slots.`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await close();
  }
}
