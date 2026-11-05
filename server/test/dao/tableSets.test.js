import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { close, get } from '../../src/dao/db.js';
import * as tableSets from '../../src/dao/tableSets.js';
import { cleanBookingData } from '../helpers/bookingFixtures.js';

// A name that cleanBookingData() removes.
const uniqueName = () => `test-${randomUUID()}`;

const LUNCH = [
  { tableNumber: 3, capacity: 6 },
  { tableNumber: 1, capacity: 2 },
  { tableNumber: 2, capacity: 4 },
];

const countSetsNamed = async (name) =>
  (await get('SELECT COUNT(*)::INT AS n FROM table_set WHERE name = $1', [name])).n;

beforeEach(cleanBookingData);
afterAll(async () => {
  await cleanBookingData();
  await close();
});

describe('table sets dao', () => {
  it('creates a set with its tables and finds it, with the tables in order of number', async () => {
    const name = uniqueName();
    const tableSetId = await tableSets.insert({ name, tables: LUNCH });

    expect(await tableSets.findById(tableSetId)).toEqual({
      tableSetId,
      name,
      tables: [
        { tableNumber: 1, capacity: 2 },
        { tableNumber: 2, capacity: 4 },
        { tableNumber: 3, capacity: 6 },
      ],
    });
  });

  it('answers null for a name that is already used, and keeps the first set as it was', async () => {
    const name = uniqueName();
    const first = await tableSets.insert({ name, tables: LUNCH });

    expect(await tableSets.insert({ name, tables: [{ tableNumber: 1, capacity: 10 }] })).toBeNull();

    expect(await countSetsNamed(name)).toBe(1);
    expect((await tableSets.findById(first)).tables).toHaveLength(3);
  });

  it('keeps only one set when two requests with the same name arrive together', async () => {
    const name = uniqueName();

    const results = await Promise.all([
      tableSets.insert({ name, tables: LUNCH }),
      tableSets.insert({ name, tables: LUNCH }),
    ]);

    expect(results.filter((id) => id === null)).toHaveLength(1);
    expect(await countSetsNamed(name)).toBe(1);
  });

  it.each([
    ['a table number used twice', [{ tableNumber: 1, capacity: 2 }, { tableNumber: 1, capacity: 4 }], '23505'],
    ['a table with no seats', [{ tableNumber: 1, capacity: 0 }], '23514'],
    ['a table number below 1', [{ tableNumber: 0, capacity: 2 }], '23514'],
  ])('refuses %s and leaves no set behind', async (_label, tables, code) => {
    const name = uniqueName();

    await expect(tableSets.insert({ name, tables })).rejects.toMatchObject({ code });

    expect(await countSetsNamed(name)).toBe(0);
  });

  it('lists every set with its tables, in order of creation', async () => {
    const a = await tableSets.insert({ name: uniqueName(), tables: LUNCH });
    const b = await tableSets.insert({ name: uniqueName(), tables: [{ tableNumber: 1, capacity: 8 }] });

    const listed = (await tableSets.findAll()).filter((set) => [a, b].includes(set.tableSetId));

    expect(listed.map((set) => set.tableSetId)).toEqual([a, b]);
    expect(listed[0].tables).toHaveLength(3);
    expect(listed[1].tables).toEqual([{ tableNumber: 1, capacity: 8 }]);
  });

  it('finds several sets at once, in order of id, and none for no ids', async () => {
    const a = await tableSets.insert({ name: uniqueName(), tables: LUNCH });
    const b = await tableSets.insert({ name: uniqueName(), tables: [{ tableNumber: 1, capacity: 8 }] });

    expect((await tableSets.findByIds([b, a])).map((set) => set.tableSetId)).toEqual([a, b]);
    expect(await tableSets.findByIds([])).toEqual([]);
  });

  it('finds nothing for an id that does not exist', async () => {
    expect(await tableSets.findById(999999999)).toBeNull();
  });

  // The API ids are int64 but the column is an INTEGER: a larger id is a set that does not exist.
  it('finds nothing for an id above the largest integer of the database', async () => {
    expect(await tableSets.findById(3000000000)).toBeNull();
    expect(await tableSets.findByIds([3000000000])).toEqual([]);
  });
});
