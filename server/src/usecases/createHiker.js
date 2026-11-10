/**
 * Use case: the employee creates the hiker a reservation is for, when they are not in the system
 * yet (MH-07). Two cases:
 *
 *   with an email     a regular account. The server generates the first password (the role is
 *                     always HIKER), keeps only its hash and sends the password by email to the
 *                     hiker: the employee never sees it. The hiker must change it at the first
 *                     login (mustChangePassword), or choose another with the password reset.
 *   without an email  a temporary hiker: a name and, at most, a phone number. It cannot log in.
 *
 * The email leaves when the hiker is created. If it fails the account still exists, the failure is
 * only written to the log, and the answer is the same: the hiker can ask for a password reset.
 * Returns the hiker as the staff sees one: { id, firstName, lastName, email, phone, temporary }.
 *
 * Errors: 403 the user is not staff; 409 an account with this email already exists.
 */
import { ConflictError } from '../domain/errors.js';
import { hikerAccountEmail } from '../domain/hikerAccountEmail.js';
import { ROLES } from '../domain/roles.js';
import { requireStaff } from './requireStaff.js';

export const makeCreateHiker = ({ users, passwordHasher, passwordGenerator, mailer, appUrl }) =>
  async ({ user, firstName, lastName, email = null, phone = null }) => {
    requireStaff(user);

    if (email === null) {
      return users.insertTemporaryHiker({ firstName, lastName, phone });
    }

    const password = passwordGenerator.generate();
    const created = await users.insert({
      firstName,
      lastName,
      email,
      phone,
      role: ROLES.HIKER,
      passwordHash: await passwordHasher.hash(password),
      mustChangePassword: true,
    });
    if (created === null) throw new ConflictError('An account with this email already exists');

    try {
      await mailer.send(hikerAccountEmail({ firstName, lastName, email, password, loginUrl: `${appUrl}/login` }));
    } catch (error) {
      console.error(`The account email of hiker ${created.id} was not sent:`, error);
    }

    return {
      id: created.id,
      firstName: created.firstName,
      lastName: created.lastName,
      email: created.email,
      phone: created.phone,
      temporary: false,
    };
  };
