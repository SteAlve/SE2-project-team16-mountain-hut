/**
 * Use case: the staff gives a table set to a slot that has none, so that it can be booked (MH-02).
 * Giving the set it has already is fine (nothing changes). Changing the set of a slot is the
 * modification of the slot, which is not done here.
 *
 * Errors: 403 the user is not staff; 404 the slot or the table set does not exist; 409 the slot
 * has another table set.
 */
import { ConflictError, NotFoundError } from '../domain/errors.js';
import { describeStaffSlot, describeTableSet } from '../domain/tableSets.js';
import { requireStaff } from './requireStaff.js';

export const makeAssignTableSet = ({ slots, tableSets }) => async ({ user, slotId, tableSetId }) => {
  requireStaff(user);

  const slot = await slots.findById(slotId);
  if (slot === null) throw new NotFoundError(`Slot ${slotId} not found`);
  const tableSet = await tableSets.findById(tableSetId);
  if (tableSet === null) throw new NotFoundError(`Table set ${tableSetId} not found`);

  if (slot.tableSetId !== tableSetId) {
    const assigned = await slots.assignTableSet(slotId, tableSetId);
    // Not assigned: someone gave the slot a set just now. It is fine only if it is the same one.
    if (!assigned && (await slots.findById(slotId)).tableSetId !== tableSetId) {
      throw new ConflictError(`Slot ${slotId} already has a different table set`);
    }
  }

  return describeStaffSlot(slot, describeTableSet(tableSet));
};
