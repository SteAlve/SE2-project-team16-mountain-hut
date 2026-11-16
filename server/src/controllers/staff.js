/**
 * Controllers of the staff endpoints: the table sets and the slots (MH-02) and the reservations for
 * a hiker (MH-07). requireAuth has put the logged-in user in req.user; which role may do what is
 * decided by the use cases.
 */
import {
  parseCreateStaffBooking,
  parseSeatingRequest,
  toBookingDto,
  toSeatingDto,
} from '../dto/bookings.js';
import {
  parseAssignTableSet,
  parseCreateHiker,
  parseCreateSlot,
  parseCreateTableSet,
  parseListStaffSlots,
  parseSearchHikers,
  toHikerDto,
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

// GET /api/staff/hikers?q=: the regular accounts that match (MH-07).
export const makeSearchHikersController = ({ searchHikers }) => async (req, res) => {
  const input = parseSearchHikers(req.query);
  const hikers = await searchHikers({ user: req.user, ...input });
  res.status(200).json(hikers.map(toHikerDto));
};

// POST /api/staff/hikers: a regular account (with an email, the password goes to the hiker by email)
// or a temporary hiker (without one). The password is never in the answer.
export const makeCreateHikerController = ({ createHiker }) => async (req, res) => {
  const input = parseCreateHiker(req.body);
  res.status(201).json(toHikerDto(await createHiker({ user: req.user, ...input })));
};

// GET /api/staff/slots/:slotId/seating?partySize=: the seating preview, with the time limit of the staff.
export const makeStaffSeatingController = ({ previewStaffSeating }) => async (req, res) => {
  const input = parseSeatingRequest(req.params, req.query);
  res.status(200).json(toSeatingDto(await previewStaffSeating({ user: req.user, ...input })));
};

// POST /api/staff/bookings: books the tables of the preview for a hiker.
export const makeCreateStaffBookingController = ({ bookTableForHiker }) => async (req, res) => {
  const input = parseCreateStaffBooking(req.body);
  res.status(201).json(toBookingDto(await bookTableForHiker({ user: req.user, ...input })));
};
