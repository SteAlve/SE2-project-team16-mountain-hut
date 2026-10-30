import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { all, close, get, run } from '../src/dao/db.js';
import * as bookings from '../src/dao/bookings.js';
import {
  demoSlots,
  DEMO_STAFF,
  DEMO_TABLE_LAYOUTS,
  seedSlots,
  seedStaff,
} from '../scripts/seed.js';
import { createHiker } from './helpers/bookingFixtures.js';

const TODAY = '2090-01-10';
const DEMO_SETS = "SELECT id FROM table_set WHERE name LIKE 'Demo %'";

// Removes what the seed adds (and the test books), so the other test files do not see it.
const cleanDemoSlots = async () => {
  await run(`DELETE FROM booking WHERE table_set_id IN (${DEMO_SETS})`);
  await run(`DELETE FROM slot WHERE table_set_id IN (${DEMO_SETS})`);
  await run(`DELETE FROM hut_table WHERE table_set_id IN (${DEMO_SETS})`);
  await run("DELETE FROM table_set WHERE name LIKE 'Demo %'");
  await run("DELETE FROM app_user WHERE email = 'seed.hiker@example.com'");
};

beforeEach(cleanDemoSlots);
afterAll(async () => {
  await cleanDemoSlots();
  await close();
});

describe('seedStaff', () => {
  it('is idempotent and creates the demo staff', async () => {
    await run('DELETE FROM app_user WHERE email = ANY($1)', [DEMO_STAFF.map((s) => s.email)]);
    await seedStaff();
    await seedStaff();
    const rows = await all('SELECT email, role FROM app_user WHERE email = ANY($1)', [DEMO_STAFF.map((s) => s.email)]);
    expect(rows).toHaveLength(DEMO_STAFF.length);
    expect(rows.some((r) => r.role === 'WARDEN')).toBe(true);
  });
});

describe('seedSlots', () => {
  const countDemo = async () => ({
    sets: (await get("SELECT COUNT(*)::INT AS n FROM table_set WHERE name LIKE 'Demo %'")).n,
    tables: (await get(`SELECT COUNT(*)::INT AS n FROM hut_table WHERE table_set_id IN (${DEMO_SETS})`)).n,
    slots: (await get(`SELECT COUNT(*)::INT AS n FROM slot WHERE table_set_id IN (${DEMO_SETS})`)).n,
  });

  it('creates the demo table sets, their tables and the slots, and is idempotent', async () => {
    const first = await seedSlots(TODAY);
    const expectedTables = DEMO_TABLE_LAYOUTS.reduce((sum, layout) => sum + layout.tableCapacities.length, 0);
    expect(first.tablesCreated).toBe(expectedTables);
    expect(await countDemo()).toEqual({ sets: DEMO_TABLE_LAYOUTS.length, tables: expectedTables, slots: demoSlots(TODAY).length });

    const second = await seedSlots(TODAY);
    expect(second.tablesCreated).toBe(0);
    expect(await countDemo()).toEqual({ sets: DEMO_TABLE_LAYOUTS.length, tables: expectedTables, slots: demoSlots(TODAY).length });
  });

  it('counts the days from the day it runs, starting from tomorrow', async () => {
    const slots = demoSlots('2090-01-31');
    expect(slots[0].serviceDate).toBe('2090-02-01');
    expect(slots.every((slot) => slot.serviceDate > '2090-01-31')).toBe(true);
    expect(new Set(slots.map((slot) => `${slot.serviceDate} ${slot.startsAt}`)).size).toBe(slots.length);
    expect(demoSlots('2090-03-01')[0].serviceDate).toBe('2090-03-02');
  });

  it('numbers the tables of a set from 1, with the capacities of the layout', async () => {
    await seedSlots(TODAY);
    const layout = DEMO_TABLE_LAYOUTS[0];
    const rows = await all(
      `SELECT table_number AS "tableNumber", seat_capacity AS "seatCapacity" FROM hut_table
       WHERE table_set_id = (SELECT id FROM table_set WHERE name = $1) ORDER BY table_number`,
      [layout.name],
    );
    expect(rows).toEqual(layout.tableCapacities.map((seatCapacity, i) => ({ tableNumber: i + 1, seatCapacity })));
  });

  it('does not change a slot that already has a booking', async () => {
    await seedSlots(TODAY);
    const demo = demoSlots(TODAY)[0];
    const slot = await get(
      'SELECT id, table_set_id AS "tableSetId" FROM slot WHERE service_date = $1 AND starts_at = $2',
      [demo.serviceDate, demo.startsAt],
    );
    const table = await get('SELECT id FROM hut_table WHERE table_set_id = $1 ORDER BY table_number LIMIT 1', [slot.tableSetId]);
    const hiker = await createHiker('seed.hiker@example.com');
    await bookings.createWithTableAssignments({
      hikerId: hiker.id, slotId: slot.id, partySize: 1, tableAssignments: [{ tableId: table.id, seatCount: 1 }],
    });
    await run("UPDATE slot SET ends_at = '23:30' WHERE id = $1", [slot.id]);

    await seedSlots(TODAY);

    expect(await get('SELECT ends_at::TEXT AS "endsAt" FROM slot WHERE id = $1', [slot.id])).toEqual({ endsAt: '23:30:00' });
  });
});
