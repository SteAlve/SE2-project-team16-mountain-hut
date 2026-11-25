/**
 * Routes of the slots. Public: the availability, and the menu of a slot (MH-10), can be checked
 * without a login.
 */
import { Router } from 'express';

export const makeSlotsRouter = ({ listSlotsController, seatingController, getSlotMenuController }) => {
  const router = Router();
  router.get('/slots', listSlotsController);
  router.get('/slots/:slotId/seating', seatingController);
  router.get('/slots/:slotId/menu', getSlotMenuController);
  return router;
};
