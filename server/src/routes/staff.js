/**
 * Routes of the staff (MH-02): the table sets and the slots of the hut. Every one needs a logged-in
 * user; the use cases answer 403 unless it is an employee or the warden.
 */
import { Router } from 'express';

export const makeStaffRouter = ({
  createTableSetController,
  listTableSetsController,
  createSlotController,
  listStaffSlotsController,
  assignTableSetController,
  requireAuth,
}) => {
  const router = Router();
  router.use('/staff', requireAuth);
  router.post('/staff/table-sets', createTableSetController);
  router.get('/staff/table-sets', listTableSetsController);
  router.post('/staff/slots', createSlotController);
  router.get('/staff/slots', listStaffSlotsController);
  router.put('/staff/slots/:slotId/table-set', assignTableSetController);
  return router;
};
