/**
 * SESSION TOKENS: the only file that makes and hashes session ids, and the tokens of the links of
 * the password reset emails (MH-07), which are made and stored the same way.
 * generate() returns a new random id (32 random bytes) and its hash: the id goes to the cookie (or
 * to the link of the email), the hash goes to the database. hash(id) finds the session (or the link)
 * of an id read from a cookie (or from the link).
 * Not here: users, sessions, HTTP.
 */
import { createHash, randomBytes } from 'node:crypto';

export const hash = (id) => createHash('sha256').update(id).digest('hex');

export function generate() {
  const id = randomBytes(32).toString('base64url');
  return { id, hash: hash(id) };
}
