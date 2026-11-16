/**
 * Controller of the bookings. requireAuth has already put the logged-in user in req.user.
 */
import {
  parseCancelBooking, parseChangeBooking, parseCreateBooking, toBookingDto, toMyBookingDto,
} from '../dto/bookings.js';

export const makeCreateBookingController = ({ bookTable }) => async (req, res) => {
  const input = parseCreateBooking(req.body);
  const booking = await bookTable({ user: req.user, ...input });
  res.status(201).json(toBookingDto(booking));
};

// GET /api/bookings: the bookings of the logged-in hiker from today on (MH-06).
export const makeListMyBookingsController = ({ listMyBookings }) => async (req, res) => {
  const bookings = await listMyBookings({ user: req.user });
  res.status(200).json(bookings.map(toMyBookingDto));
};

// PATCH /api/bookings/:bookingId: change a booking (MH-06).
export const makeChangeBookingController = ({ changeBookingAndNotify }) => async (req, res) => {
  const input = parseChangeBooking(req.params, req.body);
  const booking = await changeBookingAndNotify({ user: req.user, ...input });
  res.status(200).json(toMyBookingDto(booking));
};

// DELETE /api/bookings/:bookingId: cancel a booking (MH-08). Nothing to send back.
export const makeCancelBookingController = ({ cancelBookingAndNotify }) => async (req, res) => {
  const input = parseCancelBooking(req.params);
  await cancelBookingAndNotify({ user: req.user, ...input });
  res.status(204).end();
};
