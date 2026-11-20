/**
 * Use case: the staff creates a meal slot (MH-02): any start time and duration, and more than one
 * slot on a day. With a table set it can be booked; without one it has no seats yet.
 *
 * The slots of a day cannot overlap: one after the other is fine (12:00-13:00 and 13:00-14:00).
 *
 * Errors: 403 the user is not staff; 404 the table set does not exist; 409 another slot of that day
 * overlaps it, one starting at the same time included.
 */
import { ConflictError, NotFoundError } from '../domain/errors.js';
import { describeStaffSlot, describeTableSet } from '../domain/tableSets.js';
import { toHourMinute } from '../domain/time.js';
import { requireStaff } from './requireStaff.js';

// Says which slot is in the way. A slot with the same start keeps the message it always had.
// An overlap has the code SLOT_OVERLAP, so the client can tell it from a slot with the same start,
// and the times of the slot in the way as details, so the client can name it.
const overlapError = async (slots, { date, startsAt, endsAt }) => {
  const other = await slots.findOverlapping({ serviceDate: date, startsAt, endsAt });
  if (other === null) {
    return new ConflictError(`The slot overlaps another slot on ${date}`, { code: 'SLOT_OVERLAP' });
  }
  const inTheWay = { startsAt: toHourMinute(other.startsAt), endsAt: toHourMinute(other.endsAt) };
  if (inTheWay.startsAt === startsAt) {
    return new ConflictError(`A slot starting at ${startsAt} already exists on ${date}`);
  }
  return new ConflictError(
    `The slot overlaps the slot from ${inTheWay.startsAt} to ${inTheWay.endsAt} on ${date}`,
    { code: 'SLOT_OVERLAP', details: { slot: inTheWay } },
  );
};

export const makeCreateStaffSlot = ({ slots, tableSets }) =>
  async ({ user, date, startsAt, endsAt, tableSetId = null }) => {
    requireStaff(user);

    const tableSet = tableSetId === null ? null : await tableSets.findById(tableSetId);
    if (tableSetId !== null && tableSet === null) {
      throw new NotFoundError(`Table set ${tableSetId} not found`);
    }

    const created = await slots.insert({ serviceDate: date, startsAt, endsAt, tableSetId });
    if (created === null) throw await overlapError(slots, { date, startsAt, endsAt });

    return describeStaffSlot(
      { slotId: created.slotId, serviceDate: date, startsAt, endsAt },
      tableSet === null ? null : describeTableSet(tableSet),
    );
  };
