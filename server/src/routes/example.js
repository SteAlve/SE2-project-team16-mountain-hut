/**
 * ROUTES: here goes the URL map, one file per resource: verb + URL -> controller. This is also
 * where a middleware is put in front of the paths that need it, e.g. (requireAuth, bookTableController).
 * Not here: logic, validation, SQL, imports from other layers.
 *
 * THE CODE BELOW IS JUST AN EXAMPLE (story MH-01).
 * Delete this file when the first real one exists.
 */
import { Router } from 'express';

export const makeBookingsRouter = ({ bookTableController }) => {
  const router = Router();
  router.post('/bookings', bookTableController);
  return router;
};
