/**
 * Use case: the staff schedule-copy picker reads complete seven-day periods with their slot and
 * booking counts (MH-09).
 *
 * Errors: 403 not staff. Input validation is done by the staff DTO before this use case is called.
 */
import { requireStaff } from './requireStaff.js';

export const makeListStaffPeriodSummaries = ({ slots }) => async ({ user, from, to }) => {
  requireStaff(user);
  return slots.findPeriodSummaries(from, to);
};
