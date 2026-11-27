/**
 * Controllers of the menus (MH-10).
 *   save      PUT /api/staff/slots/:slotId/menu   the staff writes or changes the menu of a slot
 *   delete    DELETE /api/staff/slots/:slotId/menu  the staff deletes the menu of a slot
 *   previous  GET /api/staff/menus                the menus already written, to start from one
 *   get       GET /api/slots/:slotId/menu         the menu of a slot, public
 * requireAuth has put the logged-in user in req.user for the staff routes; which role may do what is
 * decided by the use cases.
 */
import {
  parseDeleteSlotMenu,
  parseGetSlotMenu,
  parseListPreviousMenus,
  parseSaveSlotMenu,
  toPreviousMenusDto,
  toSlotMenuDto,
} from '../dto/menus.js';

export const makeSaveSlotMenuController = ({ saveSlotMenu }) => async (req, res) => {
  const input = parseSaveSlotMenu(req.params, req.body);
  res.status(200).json(toSlotMenuDto(await saveSlotMenu({ user: req.user, ...input })));
};

export const makeDeleteSlotMenuController = ({ deleteSlotMenu }) => async (req, res) => {
  const input = parseDeleteSlotMenu(req.params);
  await deleteSlotMenu({ user: req.user, ...input });
  res.status(204).end();
};

export const makeListPreviousMenusController = ({ listPreviousMenus }) => async (req, res) => {
  const input = parseListPreviousMenus(req.query);
  res.status(200).json(toPreviousMenusDto(await listPreviousMenus({ user: req.user, ...input })));
};

export const makeGetSlotMenuController = ({ getSlotMenu }) => async (req, res) => {
  const input = parseGetSlotMenu(req.params);
  res.status(200).json(toSlotMenuDto(await getSlotMenu(input)));
};
