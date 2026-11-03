/**
 * Use case: the staff defines a set of tables (MH-02). It is created once and can then be given to
 * any number of slots.
 *
 * Errors: 403 the user is not staff; 409 a set with that name exists already.
 */
import { ConflictError } from '../domain/errors.js';
import { describeTableSet } from '../domain/tableSets.js';
import { requireStaff } from './requireStaff.js';

export const makeCreateTableSet = ({ tableSets }) => async ({ user, name, tables }) => {
  requireStaff(user);

  const tableSetId = await tableSets.insert({ name, tables });
  if (tableSetId === null) throw new ConflictError(`A table set named ${name} already exists`);

  return describeTableSet(await tableSets.findById(tableSetId));
};
