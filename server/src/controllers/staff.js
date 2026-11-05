/**
 * Controllers of the staff endpoints (MH-02). requireAuth has put the logged-in user in req.user;
 * which role may do what is decided by the use cases.
 */
import {
  parseAssignTableSet,
  parseCreateSlot,
  parseCreateTableSet,
  parseListStaffSlots,
  toStaffSlotDto,
  toTableSetDto,
} from '../dto/staff.js';

export const makeCreateTableSetController = ({ createTableSet }) => async (req, res) => {
  const input = parseCreateTableSet(req.body);
  res.status(201).json(toTableSetDto(await createTableSet({ user: req.user, ...input })));
};

export const makeListTableSetsController = ({ listTableSets }) => async (req, res) => {
  const sets = await listTableSets({ user: req.user });
  res.status(200).json(sets.map(toTableSetDto));
};

export const makeCreateSlotController = ({ createStaffSlot }) => async (req, res) => {
  const input = parseCreateSlot(req.body);
  res.status(201).json(toStaffSlotDto(await createStaffSlot({ user: req.user, ...input })));
};

export const makeListStaffSlotsController = ({ listStaffSlots }) => async (req, res) => {
  const input = parseListStaffSlots(req.query);
  const slots = await listStaffSlots({ user: req.user, ...input });
  res.status(200).json(slots.map(toStaffSlotDto));
};

export const makeAssignTableSetController = ({ assignTableSet }) => async (req, res) => {
  const input = parseAssignTableSet(req.params, req.body);
  res.status(200).json(toStaffSlotDto(await assignTableSet({ user: req.user, ...input })));
};
