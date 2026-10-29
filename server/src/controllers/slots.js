/**
 * Controller of the slots: the slots of a date that can still be booked. Public: no login.
 */
import { parseSlotsQuery, toBookableSlotDto } from '../dto/bookings.js';

export const makeListSlotsController = ({ listBookableSlots }) => async (req, res) => {
  const { date } = parseSlotsQuery(req.query);
  const slots = await listBookableSlots(date);
  res.status(200).json(slots.map(toBookableSlotDto));
};
