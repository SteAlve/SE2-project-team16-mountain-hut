/**
 * Use case: the hikes registered by the logged-in hiker (MH-20, the page "My hikes"), in order of
 * departure. All of them: the mockup lists the past ones too, with no status (the finished hikes
 * are MH-22). The times are the local date and time of the hut: 'YYYY-MM-DDTHH:MM'.
 *
 * Errors: 403 the user is not a hiker.
 */
import { ForbiddenError } from '../domain/errors.js';
import { describeHike } from '../domain/hike.js';
import { ROLES } from '../domain/roles.js';

export const makeListMyHikes = ({ hikes, clock, hutTimeZone }) => async ({ user }) => {
  if (user.role !== ROLES.HIKER) throw new ForbiddenError('Only hikers have hikes');

  const toLocal = (instant) => clock.localDateTime(instant.getTime(), hutTimeZone);
  const rows = await hikes.findByHiker(user.id);
  return rows.map((hike) => describeHike(hike, toLocal));
};
