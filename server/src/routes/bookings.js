/**
 * Routes of the bookings. A booking needs a logged-in user (which role may book is decided
 * by the use case).
 */
import { Router } from 'express';

export const makeBookingsRouter = ({ createBookingController, requireAuth }) => {
  const router = Router();
  router.post('/bookings', requireAuth, createBookingController);
  return router;
};
