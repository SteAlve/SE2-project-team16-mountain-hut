/**
 * Routes of the slots. Public: the availability can be checked without a login.
 */
import { Router } from 'express';

export const makeSlotsRouter = ({ listSlotsController }) => {
  const router = Router();
  router.get('/slots', listSlotsController);
  return router;
};
