/**
 * DAO of the users (table app_user). The password hash is returned only by findByEmail and
 * findPasswordHashById, which the login and the change of the password need; every other query
 * leaves it out.
 *
 * A hiker is a user with the role HIKER. A temporary hiker (MH-07) is one the staff entered with a
 * name and, at most, a phone number: it has no email and no password, so it never logs in.
 */
import { all, get } from './db.js';

const PUBLIC_COLUMNS = `id, first_name AS "firstName", last_name AS "lastName", email, phone, role,
  must_change_password AS "mustChangePassword"`;

// What the staff sees of a hiker.
const HIKER_COLUMNS = `id, first_name AS "firstName", last_name AS "lastName", email, phone, temporary`;

export const findByEmail = (email) => get(
  `SELECT ${PUBLIC_COLUMNS}, password_hash AS "passwordHash" FROM app_user WHERE email = $1`,
  [email],
);

// The hash of the password of the user, or null when there is no such user.
export const findPasswordHashById = async (id) => (await get(
  'SELECT password_hash AS "passwordHash" FROM app_user WHERE id = $1',
  [id],
))?.passwordHash ?? null;

// Returns the new user, or null when the email is already used (the unique index decides, so two
// sign ups at the same time cannot both succeed). A hiker made by the staff has
// mustChangePassword true: the password was generated and somebody else knows it.
export const insert = ({ firstName, lastName, email, phone, role, passwordHash, mustChangePassword = false }) => get(
  `INSERT INTO app_user (first_name, last_name, email, phone, role, password_hash, must_change_password)
   VALUES ($1, $2, $3, $4, $5, $6, $7)
   ON CONFLICT (email) DO NOTHING
   RETURNING ${PUBLIC_COLUMNS}`,
  [firstName, lastName, email, phone, role, passwordHash, mustChangePassword],
);

// A temporary hiker: only a name and, at most, a phone number. Returns it as the staff sees a hiker.
export const insertTemporaryHiker = ({ firstName, lastName, phone }) => get(
  `INSERT INTO app_user (first_name, last_name, phone, role, temporary)
   VALUES ($1, $2, $3, 'HIKER', true)
   RETURNING ${HIKER_COLUMNS}`,
  [firstName, lastName, phone],
);

// The hiker with that id, temporary or not, or null. A user with another role is not a hiker. The id
// is compared as a BIGINT: the API ids are int64 and the column is an INTEGER, so an id above
// 2147483647 is a hiker that does not exist, not an "out of range" error (500).
export const findHikerById = (id) => get(
  `SELECT ${HIKER_COLUMNS} FROM app_user WHERE id = $1::BIGINT AND role = 'HIKER'`,
  [id],
);

// % and _ are wildcards in LIKE: the text of the search is taken as it is.
const likePattern = (text) => `%${text.replace(/[\\%_]/g, '\\$&')}%`;

// The regular hiker accounts whose first name, last name, both names (in either order), email or
// phone contain the text, in any letter case. Temporary hikers are not listed. The spaces of a
// phone number do not count. At most `limit`, by last name and first name.
export const searchHikers = (text, limit = 20) => {
  const withoutSpaces = text.replaceAll(' ', '');
  return all(
    `SELECT ${HIKER_COLUMNS}
     FROM app_user
     WHERE role = 'HIKER' AND NOT temporary
       AND (first_name ILIKE $1
         OR last_name ILIKE $1
         OR first_name || ' ' || last_name ILIKE $1
         OR last_name || ' ' || first_name ILIKE $1
         OR email ILIKE $1
         OR replace(phone, ' ', '') ILIKE $2)
     ORDER BY last_name, first_name, id
     LIMIT $3`,
    [likePattern(text), withoutSpaces === '' ? null : likePattern(withoutSpaces), limit],
  );
};

// Gives the user a new password, which clears the obligation to change it. Returns false when there
// is no such user, or when it is a temporary hiker, who has no password.
export const updatePassword = async ({ userId, passwordHash }) => (await get(
  `UPDATE app_user SET password_hash = $2, must_change_password = false
   WHERE id = $1 AND NOT temporary
   RETURNING id`,
  [userId, passwordHash],
)) !== null;
