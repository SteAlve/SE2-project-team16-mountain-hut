/**
 * Use case: the slots between two days, both included, as the staff sees them (MH-02): also the slots
 * without a table set, the full ones and the ones no longer open for booking, each with its table set.
 *
 * Errors: 403 the user is not staff.
 */
import { describeStaffSlot, describeTableSet } from '../domain/tableSets.js';
import { requireStaff } from './requireStaff.js';

export const makeListStaffSlots = ({ slots, tableSets }) => async ({ user, from, to }) => {
  requireStaff(user);

  const rows = await slots.findBetween(from, to);
  const ids = [...new Set(rows.map((row) => row.tableSetId).filter((id) => id !== null))];
  const sets = new Map((await tableSets.findByIds(ids)).map((set) => [set.tableSetId, describeTableSet(set)]));

  return rows.map((row) => describeStaffSlot(row, row.tableSetId === null ? null : sets.get(row.tableSetId)));
};
