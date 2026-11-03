/**
 * DAO of the login sessions (table session). A session is known by the hash of its id, never by
 * the id itself.
 */
import { get, run } from './db.js';

export const insert = ({ tokenHash, userId, expiresAt }) => run(
  'INSERT INTO session (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
  [tokenHash, userId, expiresAt],
);

// The session and its user, or null. Whether the session has expired is decided by the domain.
export const findByTokenHash = (tokenHash) => get(
  `SELECT s.expires_at AS "expiresAt",
          u.id, u.first_name AS "firstName", u.last_name AS "lastName", u.email, u.phone, u.role
   FROM session s
   JOIN app_user u ON u.id = s.user_id
   WHERE s.token_hash = $1`,
  [tokenHash],
);

export const remove = (tokenHash) => run('DELETE FROM session WHERE token_hash = $1', [tokenHash]);

// Housekeeping: the sessions that nobody can use any more.
export const removeExpired = (now) => run('DELETE FROM session WHERE expires_at <= $1', [now]);
