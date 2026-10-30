/**
 * Controller of the bookings. requireAuth has already put the logged-in user in req.user.
 */
import { parseCreateBooking, toBookingDto } from '../dto/bookings.js';

export const makeCreateBookingController = ({ createBooking }) => async (req, res) => {
  const input = parseCreateBooking(req.body);
  const booking = await createBooking({ user: req.user, ...input });
  res.status(201).json(toBookingDto(booking));
};
