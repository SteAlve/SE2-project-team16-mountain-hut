/**
 * SEED: creates the demo hut staff (one warden, two employees) so that the app can be tried and
 * demoed without a sign up page for staff. Run it with `npm run db:seed`, after `npm run db:migrate`.
 * It is safe to run again: an account whose email already exists is left untouched.
 *
 * The password below is a DEMO password, published in the README. Do not seed a real hut with it.
 */
import { fileURLToPath } from 'node:url';
import { close } from '../src/dao/db.js';
import * as users from '../src/dao/users.js';
import { hash } from '../src/passwordHasher.js';

export const DEMO_PASSWORD = 'quota-demo-2026';

export const DEMO_STAFF = [
  { firstName: 'Emily', lastName: 'Parker', email: 'emily.parker@quota.example', role: 'WARDEN' },
  { firstName: 'James', lastName: 'Taylor', email: 'james.taylor@quota.example', role: 'EMPLOYEE' },
  { firstName: 'Oliver', lastName: 'Wilson', email: 'oliver.wilson@quota.example', role: 'EMPLOYEE' },
];

export async function seedStaff() {
  const passwordHash = await hash(DEMO_PASSWORD);
  const created = [];
  for (const staff of DEMO_STAFF) {
    const user = await users.insert({ ...staff, phone: null, passwordHash });
    if (user) created.push(staff.email);
  }
  return created;
}

// Only when started as a script (npm run db:seed), not when imported by the tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const created = await seedStaff();
    console.log(created.length > 0 ? `Created: ${created.join(', ')}` : 'Demo staff already present.');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await close();
  }
}
