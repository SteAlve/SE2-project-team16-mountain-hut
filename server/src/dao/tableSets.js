/**
 * DAO of the table sets (tables table_set and hut_table). A set is { tableSetId, name, tables }, with
 * tables = [{ tableNumber, capacity }] in order of number.
 */
import { all, get, inTransaction, run } from './db.js';

// Adds the tables to the sets given, as they come from table_set.
const withTables = async (sets) => {
  if (sets.length === 0) return [];
  const rows = await all(
    `SELECT table_set_id AS "tableSetId", table_number AS "tableNumber", seat_capacity AS capacity
     FROM hut_table
     WHERE table_set_id = ANY($1::INTEGER[])
     ORDER BY table_set_id, table_number`,
    [sets.map(({ tableSetId }) => tableSetId)],
  );
  return sets.map((set) => ({
    ...set,
    tables: rows
      .filter((row) => row.tableSetId === set.tableSetId)
      .map(({ tableNumber, capacity }) => ({ tableNumber, capacity })),
  }));
};

const SET_COLUMNS = 'id AS "tableSetId", name';

export const findAll = async () => withTables(await all(`SELECT ${SET_COLUMNS} FROM table_set ORDER BY id`));

export const findByIds = async (ids) => withTables(
  await all(`SELECT ${SET_COLUMNS} FROM table_set WHERE id = ANY($1::INTEGER[]) ORDER BY id`, [ids]),
);

export const findById = async (tableSetId) => (await findByIds([tableSetId]))[0] ?? null;

// Creates the set and its tables together. Returns the id of the new set, or null when a set with
// that name already exists (the unique index decides, so two requests at the same time cannot both succeed).
export const insert = ({ name, tables }) => inTransaction(async () => {
  const created = await get(
    'INSERT INTO table_set (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id AS "tableSetId"',
    [name],
  );
  if (created === null) return null;

  await run(
    `INSERT INTO hut_table (table_set_id, table_number, seat_capacity)
     SELECT $1, numbers.n, capacities.c
     FROM unnest($2::INTEGER[]) WITH ORDINALITY AS numbers(n, i)
     JOIN unnest($3::INTEGER[]) WITH ORDINALITY AS capacities(c, i) USING (i)`,
    [created.tableSetId, tables.map((t) => t.tableNumber), tables.map((t) => t.capacity)],
  );
  return created.tableSetId;
});
