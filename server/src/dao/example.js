/**
 * DAO: here goes the SQL, one file per table or group of tables. Queries use bound parameters
 * ($1, $2, ...) through the helpers of db.js, and return plain objects with camelCase names.
 * Not here: the database driver (only db.js), business rules, HTTP, imports from other layers.
 *
 * THE CODE BELOW IS JUST AN EXAMPLE (story MH-01). The slot table is only assumed.
 * Delete this file when the first real one exists.
 */
import { get } from './db.js';

export const findById = (id) => get(
  'SELECT id, starts_at AS "startsAt" FROM slot WHERE id = $1',
  [id],
);
