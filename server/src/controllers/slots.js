/**
 * Controller of the slots: the slots of a date that can still be booked. Public: no login.
 */
import {parseSeatingRequest, toSeatingDto, toSlotDto} from '../dto/bookings.js';

export const makeListSlotsController = ({ listSlots }) => async (req, res) => {
  const slots = await listSlots();
  res.status(200).json(slots.map(toSlotDto));
};

export const makeSeatingController = ({ previewSeating }) => async (req, res) => {
  const { slotId, partySize } = parseSeatingRequest(req.params, req.query);
  const seating = await previewSeating({ slotId, partySize });
  res.status(200).json(toSeatingDto(seating));
}
