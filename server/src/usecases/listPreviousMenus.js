/**
 * Use case: the menus already written, so that the staff can start a new one from one of them
 * (MH-10, "Start from a previous menu"). Newest first; the same text is listed once, with the last
 * slot it was saved for. exceptSlotId leaves out the slot whose menu is being written. search finds a
 * dish or a day. limit and offset give the page: "Show older menus" asks for the next one.
 *
 * Errors: 403 the user is not staff.
 */
import { describeSlotMenu } from '../domain/slotMenu.js';
import { requireStaff } from './requireStaff.js';

export const makeListPreviousMenus = ({ slots }) => async ({ user, exceptSlotId, search, limit, offset }) => {
  requireStaff(user);

  const { menus, hasMore } = await slots.findPreviousMenus({ exceptSlotId, search, limit, offset });
  return { menus: menus.map(describeSlotMenu), hasMore };
};
