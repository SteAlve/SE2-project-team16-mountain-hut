/**
 * Use case helper: only the staff (employees and the warden) can define the tables and the slots.
 * Throws ForbiddenError (403) for anybody else, hikers included.
 */
import { ForbiddenError } from '../domain/errors.js';
import { isStaff } from '../domain/roles.js';

export const requireStaff = (user) => {
  if (!isStaff(user.role)) throw new ForbiddenError('Only the staff can do this');
};
