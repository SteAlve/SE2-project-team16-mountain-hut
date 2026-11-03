/**
 * Controller of the slots. Public: no login.
 *   list     every slot from today on (no parameters: "today" is the one of the hut)
 *   seating  where a party would sit in a slot, without booking
 */
import { parseSeatingRequest, toSeatingDto, toSlotDto } from '../dto/bookings.js';

export const makeListSlotsController = ({ listSlots }) => async (_req, res) => {
  const slots = await listSlots();
  res.status(200).json(slots.map(toSlotDto));
};

export const makeSeatingController = ({ previewSeating }) => async (req, res) => {
  const input = parseSeatingRequest(req.params, req.query);
  res.status(200).json(toSeatingDto(await previewSeating(input)));
};
