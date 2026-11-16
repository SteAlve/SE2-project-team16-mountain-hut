/**
 * Routes of the staff: the table sets and the slots of the hut (MH-02) and the reservations for a
 * hiker (MH-07): find or create the hiker, ask where the party would sit, book. Every one needs a
 * logged-in user; the use cases answer 403 unless it is an employee or the warden.
 */
import { Router } from 'express';

export const makeStaffRouter = ({
  createTableSetController,
  listTableSetsController,
  createSlotController,
  listStaffSlotsController,
  assignTableSetController,
  searchHikersController,
  createHikerController,
  staffSeatingController,
  createStaffBookingController,
  requireAuth,
}) => {
  const router = Router();
  router.use('/staff', requireAuth);
  router.post('/staff/table-sets', createTableSetController);
  router.get('/staff/table-sets', listTableSetsController);
  router.post('/staff/slots', createSlotController);
  router.get('/staff/slots', listStaffSlotsController);
  router.put('/staff/slots/:slotId/table-set', assignTableSetController);
  router.get('/staff/slots/:slotId/seating', staffSeatingController);
  router.get('/staff/hikers', searchHikersController);
  router.post('/staff/hikers', createHikerController);
  router.post('/staff/bookings', createStaffBookingController);
  return router;
};
