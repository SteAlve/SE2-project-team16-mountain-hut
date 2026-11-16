/**
 * DAO of the links of the password reset emails (table password_reset, MH-07). A link is known by
 * the hash of its token, never by the token itself. It works once and until expires_at.
 */
import { get, inTransaction, run } from './db.js';

// Stores the link of a user. The link that was waiting to be used stops working: a user has only one.
export const insert = ({ userId, tokenHash, expiresAt }) => inTransaction(async () => {
  // Two requests at the same time for the same user go one after the other, so each one replaces
  // the link of the one before it and the unique index of the pending link never fails.
  await get('SELECT id FROM app_user WHERE id = $1 FOR UPDATE', [userId]);
  await run('DELETE FROM password_reset WHERE user_id = $1 AND used_at IS NULL', [userId]);
  await run(
    'INSERT INTO password_reset (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [tokenHash, userId, expiresAt],
  );
});

// Chooses the new password with the link. In one transaction the link is used, the password is changed
// and the obligation to change it is cleared. Returns the id of the user, or null when the link does not
// work (it never existed, was used, was replaced or has expired at `now`): then nothing changes. The
// condition is in the UPDATE, so two requests with the same link cannot both win.
export const resetPassword = ({ tokenHash, passwordHash, now }) => inTransaction(async () => {
  const used = await get(
    `UPDATE password_reset SET used_at = $2
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2
     RETURNING user_id AS "userId"`,
    [tokenHash, now],
  );
  if (used === null) return null;

  await run(
    'UPDATE app_user SET password_hash = $2, must_change_password = false WHERE id = $1',
    [used.userId, passwordHash],
  );
  return used.userId;
});

// Housekeeping: the links that nobody can use any more.
export const removeExpired = (now) => run('DELETE FROM password_reset WHERE expires_at <= $1', [now]);
