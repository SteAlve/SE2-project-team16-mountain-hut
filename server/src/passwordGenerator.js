/**
 * PASSWORD GENERATOR: the only file that makes the first password of an account made by the staff
 * (MH-07). generate() returns 12 random characters in three groups of four, like `k7mp-x4wn-r9ht`:
 * lowercase letters and digits, without the ones that look alike (0 and o, 1 and l and i), so it can
 * be read and typed from the email without mistakes. 31 symbols, 12 of them: about 59 bits.
 *
 * The password is sent to the hiker by email and never shown to the employee; the server keeps
 * only its hash. Not here: hashing (passwordHasher.js), users, email.
 */
import { randomInt } from 'node:crypto';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const GROUPS = 3;
const GROUP_LENGTH = 4;

// randomInt picks without bias, unlike taking a random byte modulo the size of the alphabet.
const pick = () => ALPHABET[randomInt(ALPHABET.length)];

export const generate = () => Array.from(
  { length: GROUPS },
  () => Array.from({ length: GROUP_LENGTH }, pick).join(''),
).join('-');
