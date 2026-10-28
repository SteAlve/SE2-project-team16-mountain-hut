/**
 * PASSWORD HASHER: the only file that knows how passwords are hashed (scrypt, built into Node).
 * hash(password) returns a string to store; verify(password, stored) says if they match.
 * The stored string is `scrypt$<salt>$<hash>`, both in base64, so the cost can change later.
 * Not here: users, sessions, HTTP.
 */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

// Checked when there is nothing to check against, so that "unknown email" costs as much time as
// "wrong password" and the answer time does not tell which emails exist.
const DUMMY_SALT = Buffer.alloc(SALT_LENGTH);

export async function hash(password) {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verify(password, stored) {
  const [scheme, saltText, keyText] = typeof stored === 'string' ? stored.split('$') : [];
  const valid = scheme === 'scrypt' && saltText && keyText;

  const salt = valid ? Buffer.from(saltText, 'base64') : DUMMY_SALT;
  const expected = valid ? Buffer.from(keyText, 'base64') : Buffer.alloc(KEY_LENGTH);
  const actual = await scryptAsync(password, salt, expected.length);

  return Boolean(valid) && timingSafeEqual(actual, expected);
}
