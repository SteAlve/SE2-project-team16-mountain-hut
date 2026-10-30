/**
 * Routes of the slots. Public: the availability can be checked without a login.
 */
import { Router } from 'express';

export const makeSlotsRouter = ({ listSlotsController, seatingController }) => {
  const router = Router();
  router.get('/slots', listSlotsController);
  router.get('/slots/:slotId/seating', seatingController);
  return router;
};
