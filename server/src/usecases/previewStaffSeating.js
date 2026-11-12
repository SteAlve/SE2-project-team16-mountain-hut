/**
 * Use case: where would a party sit in a slot, for the employee who reserves for a hiker (MH-07)?
 * The same check as the public preview (previewSeating.js, the same choice as the booking), for the
 * staff only, and with the staff time limit: the slot can be asked for until the meal starts. The
 * `checkSlotOpen` that app.js hands over is makeCheckSlotOpenForStaff.
 *
 * Errors: 403 the user is not staff; 404 the slot does not exist; 422 it cannot be booked or has
 * started; 409 the party does not fit.
 */
import { makePreviewSeating } from './previewSeating.js';
import { requireStaff } from './requireStaff.js';

export const makePreviewStaffSeating = ({ slots, checkSlotOpen }) => {
  const previewSeating = makePreviewSeating({ slots, checkSlotOpen });

  return async ({ user, slotId, partySize }) => {
    requireStaff(user);
    return previewSeating({ slotId, partySize });
  };
};
