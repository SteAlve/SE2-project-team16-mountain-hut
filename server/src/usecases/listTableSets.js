/**
 * Use case: every table set, with its tables, so that one can be given to a slot (MH-02).
 *
 * Errors: 403 the user is not staff.
 */
import { describeTableSet } from '../domain/tableSets.js';
import { requireStaff } from './requireStaff.js';

export const makeListTableSets = ({ tableSets }) => async ({ user }) => {
  requireStaff(user);
  return (await tableSets.findAll()).map(describeTableSet);
};
