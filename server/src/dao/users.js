/**
 * DAO of the users (table app_user). The password hash is returned only by findByEmail, which the
 * login needs; every other query leaves it out.
 */
import { get } from './db.js';

const PUBLIC_COLUMNS = `id, first_name AS "firstName", last_name AS "lastName", email, phone, role`;

export const findByEmail = (email) => get(
  `SELECT ${PUBLIC_COLUMNS}, password_hash AS "passwordHash" FROM app_user WHERE email = $1`,
  [email],
);

// Returns the new user, or null when the email is already used (the unique index decides, so two
// sign ups at the same time cannot both succeed).
export const insert = ({ firstName, lastName, email, phone, role, passwordHash }) => get(
  `INSERT INTO app_user (first_name, last_name, email, phone, role, password_hash)
   VALUES ($1, $2, $3, $4, $5, $6)
   ON CONFLICT (email) DO NOTHING
   RETURNING ${PUBLIC_COLUMNS}`,
  [firstName, lastName, email, phone, role, passwordHash],
);
