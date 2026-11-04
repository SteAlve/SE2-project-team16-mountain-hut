/**
 * Use case: the staff creates a meal slot (MH-02): any start time and duration, and more than one
 * slot on a day. With a table set it can be booked; without one it has no seats yet.
 *
 * Errors: 403 the user is not staff; 404 the table set does not exist; 409 a slot starting at
 * that time exists already on that day.
 */
import { ConflictError, NotFoundError } from '../domain/errors.js';
import { describeStaffSlot, describeTableSet } from '../domain/tableSets.js';
import { requireStaff } from './requireStaff.js';

export const makeCreateStaffSlot = ({ slots, tableSets }) =>
  async ({ user, date, startsAt, endsAt, tableSetId = null }) => {
    requireStaff(user);

    const tableSet = tableSetId === null ? null : await tableSets.findById(tableSetId);
    if (tableSetId !== null && tableSet === null) {
      throw new NotFoundError(`Table set ${tableSetId} not found`);
    }

    const created = await slots.insert({ serviceDate: date, startsAt, endsAt, tableSetId });
    if (created === null) throw new ConflictError(`A slot starting at ${startsAt} already exists on ${date}`);

    return describeStaffSlot(
      { slotId: created.slotId, serviceDate: date, startsAt, endsAt },
      tableSet === null ? null : describeTableSet(tableSet),
    );
  };
