import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { close, get, run } from '../../src/dao/db.js';
import * as bookings from '../../src/dao/bookings.js';
import * as sessions from '../../src/dao/sessions.js';
import * as users from '../../src/dao/users.js';
import { cleanBookingData, createSlot } from '../helpers/bookingFixtures.js';

// Everything this file makes has a last name starting with "Mh7": it is removed before and after.
const LAST = 'Mh7';

const regular = (firstName, lastName = `${LAST}Rossi`, extra = {}) => users.insert({
  firstName,
  lastName,
  email: `${firstName}.${lastName}@mh7.test`.toLowerCase(),
  phone: null,
  role: 'HIKER',
  passwordHash: 'scrypt$old$hash',
  ...extra,
});

const clean = async () => {
  await cleanBookingData();
  await run(`DELETE FROM booking WHERE hiker_id IN (SELECT id FROM app_user WHERE last_name LIKE '${LAST}%')`);
  await run(`DELETE FROM app_user WHERE last_name LIKE '${LAST}%'`);
};

beforeEach(clean);
afterAll(async () => {
  await clean();
  await close();
});

describe('a hiker made by the staff', () => {
  it('has a password that must be changed, and the login and the session say so', async () => {
    const hiker = await regular('Marco', `${LAST}Bianchi`, { mustChangePassword: true });
    expect(hiker).toMatchObject({ firstName: 'Marco', role: 'HIKER', mustChangePassword: true });
    expect(hiker).not.toHaveProperty('passwordHash');

    expect(await users.findByEmail(hiker.email)).toMatchObject({ id: hiker.id, mustChangePassword: true, passwordHash: 'scrypt$old$hash' });

    await sessions.insert({ tokenHash: 'mh7-session', userId: hiker.id, expiresAt: new Date(Date.now() + 60_000) });
    expect(await sessions.findByTokenHash('mh7-session')).toMatchObject({ id: hiker.id, mustChangePassword: true });
  });

  it('is the same as anyone who signed up when nothing says otherwise', async () => {
    const hiker = await regular('Anna');
    expect(hiker.mustChangePassword).toBe(false);
  });

  it('answers null for an email that is already used', async () => {
    await regular('Marco', `${LAST}Bianchi`);
    expect(await regular('Marco', `${LAST}Bianchi`)).toBeNull();
  });
});

describe('a temporary hiker', () => {
  it('is a name and a phone number, as the staff sees a hiker', async () => {
    const hiker = await users.insertTemporaryHiker({ firstName: 'Giulia', lastName: `${LAST}Verdi`, phone: '+39 333 987 6543' });

    expect(hiker).toEqual({
      id: expect.any(Number),
      firstName: 'Giulia',
      lastName: `${LAST}Verdi`,
      email: null,
      phone: '+39 333 987 6543',
      temporary: true,
    });
    expect(await get('SELECT role, password_hash, must_change_password FROM app_user WHERE id = $1', [hiker.id]))
      .toEqual({ role: 'HIKER', password_hash: null, must_change_password: false });
  });

  it('can have no phone, and two of them can have the same name', async () => {
    const first = await users.insertTemporaryHiker({ firstName: 'Giulia', lastName: `${LAST}Verdi`, phone: null });
    const second = await users.insertTemporaryHiker({ firstName: 'Giulia', lastName: `${LAST}Verdi`, phone: null });

    expect(first.phone).toBeNull();
    expect(second.id).not.toBe(first.id);
  });

  it('cannot have an email or a password, and only a hiker can be temporary (the database refuses)', async () => {
    const insert = (columns, values) => run(`INSERT INTO app_user (first_name, last_name, ${columns}) VALUES ('A', '${LAST}', ${values})`);

    await expect(insert('email, role, temporary', "'t@mh7.test', 'HIKER', true")).rejects.toMatchObject({ code: '23514' });
    await expect(insert('role, temporary, password_hash', "'HIKER', true, 'x'")).rejects.toMatchObject({ code: '23514' });
    await expect(insert('role, temporary, must_change_password', "'HIKER', true, true")).rejects.toMatchObject({ code: '23514' });
    await expect(insert('role, temporary', "'EMPLOYEE', true")).rejects.toMatchObject({ code: '23514' });
  });

  it('is the only kind of account without an email and a password (the database refuses the others)', async () => {
    await expect(regular('Marco', `${LAST}Bianchi`, { passwordHash: null })).rejects.toMatchObject({ code: '23514' });
    await expect(regular('Marco', `${LAST}Bianchi`, { email: null })).rejects.toMatchObject({ code: '23514' });
  });

  it('can book, and the confirmation has no email to go to', async () => {
    const hiker = await users.insertTemporaryHiker({ firstName: 'Giulia', lastName: `${LAST}Verdi`, phone: null });
    const slot = await createSlot({ seats: [4] });

    const booking = await bookings.createWithTableAssignments({
      hikerId: hiker.id,
      slotId: slot.slotId,
      partySize: 3,
      tableAssignments: [{ tableId: slot.tableIds[0], seatCount: 3 }],
    });

    expect(await bookings.findConfirmationDetails(booking.id)).toMatchObject({ firstName: 'Giulia', email: null, partySize: 3 });
    expect(await bookings.hasActiveBooking(hiker.id, slot.slotId)).toBe(true);
  });
});

describe('findHikerById', () => {
  it('finds a regular account and a temporary hiker, and says which is which', async () => {
    const account = await regular('Marco', `${LAST}Bianchi`);
    const temporary = await users.insertTemporaryHiker({ firstName: 'Giulia', lastName: `${LAST}Verdi`, phone: null });

    expect(await users.findHikerById(account.id)).toEqual({
      id: account.id, firstName: 'Marco', lastName: `${LAST}Bianchi`, email: account.email, phone: null, temporary: false,
    });
    expect(await users.findHikerById(temporary.id)).toMatchObject({ id: temporary.id, email: null, temporary: true });
  });

  it('answers null for an employee, for the warden and for an id that does not exist', async () => {
    const employee = await regular('Elena', `${LAST}Staff`, { role: 'EMPLOYEE' });
    const warden = await regular('Walter', `${LAST}Staff`, { role: 'WARDEN' });

    expect(await users.findHikerById(employee.id)).toBeNull();
    expect(await users.findHikerById(warden.id)).toBeNull();
    expect(await users.findHikerById(999999999)).toBeNull();
  });

  it('answers null, not an error, for an id above 2147483647', async () => {
    expect(await users.findHikerById(3000000000)).toBeNull();
  });
});

describe('searchHikers', () => {
  // The first names start with Mh7 too, so that nobody else in the database can match.
  const names = (hikers) => hikers.map(({ firstName, lastName }) => `${firstName} ${lastName}`);
  const PHONE = '+39 399 777 1234';

  it('finds a hiker by the first name, the last name, both names in either order, or a part of them', async () => {
    await regular('Mh7Marco', `${LAST}Bianchi`);
    await regular('Mh7Anna', `${LAST}Verdi`);

    expect(names(await users.searchHikers('mh7marco'))).toEqual([`Mh7Marco ${LAST}Bianchi`]);
    expect(names(await users.searchHikers('mh7verdi'))).toEqual([`Mh7Anna ${LAST}Verdi`]);
    expect(names(await users.searchHikers(`Mh7Marco ${LAST}Bianchi`))).toEqual([`Mh7Marco ${LAST}Bianchi`]);
    expect(names(await users.searchHikers(`${LAST}Bianchi Mh7Marco`))).toEqual([`Mh7Marco ${LAST}Bianchi`]);
    expect(names(await users.searchHikers('h7bianc'))).toEqual([`Mh7Marco ${LAST}Bianchi`]);
  });

  it('finds a hiker by a part of the email, in any letter case', async () => {
    const hiker = await regular('Mh7Marco', `${LAST}Bianchi`);

    expect((await users.searchHikers('MH7MARCO.mh7bianchi@')).map(({ id }) => id)).toEqual([hiker.id]);
    expect((await users.searchHikers('@mh7.TEST')).map(({ id }) => id)).toContain(hiker.id);
  });

  it('finds a hiker by the phone, with or without the spaces', async () => {
    const hiker = await regular('Mh7Marco', `${LAST}Bianchi`);
    await run('UPDATE app_user SET phone = $2 WHERE id = $1', [hiker.id, PHONE]);

    expect((await users.searchHikers('399 777')).map(({ id }) => id)).toEqual([hiker.id]);
    expect((await users.searchHikers('3997771234')).map(({ id }) => id)).toEqual([hiker.id]);
    expect((await users.searchHikers(PHONE)).map(({ id }) => id)).toEqual([hiker.id]);
  });

  it('gives each hiker as the staff sees it, without the password', async () => {
    const hiker = await regular('Mh7Marco', `${LAST}Bianchi`);

    const [found] = await users.searchHikers('mh7marco');

    expect(found).toEqual({ id: hiker.id, firstName: 'Mh7Marco', lastName: `${LAST}Bianchi`, email: hiker.email, phone: null, temporary: false });
  });

  it('does not list temporary hikers, employees or the warden, even when the name matches', async () => {
    await regular('Mh7Marco', `${LAST}Bianchi`);
    await users.insertTemporaryHiker({ firstName: 'Mh7Marco', lastName: `${LAST}Bianchi`, phone: PHONE });
    await regular('Mh7Marco', `${LAST}Employee`, { role: 'EMPLOYEE' });
    await regular('Mh7Marco', `${LAST}Warden`, { role: 'WARDEN' });

    expect(names(await users.searchHikers('mh7marco'))).toEqual([`Mh7Marco ${LAST}Bianchi`]);
    expect(await users.searchHikers('399 777')).toEqual([]);
  });

  it('takes % and _ as they are, not as wildcards', async () => {
    await regular('Mh7Marco', `${LAST}Bianchi`);
    await regular('Mh7Anna', `${LAST}50%`);
    await regular('Mh7Luca', `${LAST}a_b`);

    expect(names(await users.searchHikers('50%'))).toEqual([`Mh7Anna ${LAST}50%`]);
    expect(names(await users.searchHikers('a_b'))).toEqual([`Mh7Luca ${LAST}a_b`]);
    expect(names(await users.searchHikers('%'))).toEqual([`Mh7Anna ${LAST}50%`]);
    expect(names(await users.searchHikers('Mh7_ianchi'))).toEqual([]);
  });

  it('answers an empty list when nobody matches, and for a text made of spaces', async () => {
    await regular('Mh7Marco', `${LAST}Bianchi`);

    expect(await users.searchHikers('nobody-called-like-this')).toEqual([]);
    expect(await users.searchHikers('   ')).toEqual([]);
  });

  it('lists at most 20 hikers by default, or as many as asked, by last name and first name', async () => {
    for (let n = 1; n <= 25; n += 1) {
      await regular('Mh7Hiker', `${LAST}Order${String(n).padStart(2, '0')}`);
    }

    const found = await users.searchHikers(`${LAST}Order`);
    expect(found).toHaveLength(20);
    expect(found[0].lastName).toBe(`${LAST}Order01`);
    expect(found[19].lastName).toBe(`${LAST}Order20`);

    expect((await users.searchHikers(`${LAST}Order`, 3)).map(({ lastName }) => lastName))
      .toEqual([`${LAST}Order01`, `${LAST}Order02`, `${LAST}Order03`]);
  });
});

describe('the password', () => {
  it('is read by the id, and null for a user that does not exist', async () => {
    const hiker = await regular('Marco', `${LAST}Bianchi`);

    expect(await users.findPasswordHashById(hiker.id)).toBe('scrypt$old$hash');
    expect(await users.findPasswordHashById(999999999)).toBeNull();
  });

  it('is changed with updatePassword, which also clears the obligation to change it', async () => {
    const hiker = await regular('Marco', `${LAST}Bianchi`, { mustChangePassword: true });

    expect(await users.updatePassword({ userId: hiker.id, passwordHash: 'scrypt$new$hash' })).toBe(true);

    expect(await users.findByEmail(hiker.email)).toMatchObject({ passwordHash: 'scrypt$new$hash', mustChangePassword: false });
  });

  it('is not changed for a user that does not exist or for a temporary hiker', async () => {
    const temporary = await users.insertTemporaryHiker({ firstName: 'Giulia', lastName: `${LAST}Verdi`, phone: null });

    expect(await users.updatePassword({ userId: 999999999, passwordHash: 'x' })).toBe(false);
    expect(await users.updatePassword({ userId: temporary.id, passwordHash: 'x' })).toBe(false);
    expect(await users.findPasswordHashById(temporary.id)).toBeNull();
  });
});
