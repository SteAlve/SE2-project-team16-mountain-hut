/**
 * Use case: a hiker registers a hike before leaving (MH-20): the start (null: the hut), the
 * destination, the route, the passage points in order, the departure and the expected return. The
 * times arrive as the local date and time
 * of the hut ('YYYY-MM-DDTHH:MM') and are saved as instants, so the later stories can compare them
 * with the clock.
 *
 * Rules: the departure is not in the past, because the story registers a hike before leaving (#172);
 * the times have no seconds, so a departure in the current minute is fine: the hiker leaves now. The
 * return is after the departure, and the times of the hike do not overlap another hike of the same
 * hiker (a hike that starts when another ends is fine).
 *
 * Returns the hike as the API shows it, with `registeredAt` (the local time of the hut) for the email.
 *
 * Errors: 403 the user is not a hiker; 400 the departure is in the past or the return is not after
 * the departure; 409 the times overlap another hike of the hiker (code HIKE_OVERLAP, with the hike in
 * the way as details).
 */
import { ConflictError, ForbiddenError, ValidationError } from '../domain/errors.js';
import { describeHike, splitLocalDateTime } from '../domain/hike.js';
import { ROLES } from '../domain/roles.js';

const MINUTE_MS = 60 * 1000;

export const makeRegisterHike = ({ hikes, clock, hutTimeZone }) => {
  const toInstant = (localDateTime) => {
    const { date, time } = splitLocalDateTime(localDateTime);
    return clock.at(date, time, hutTimeZone);
  };
  const toLocal = (instant) => clock.localDateTime(instant.getTime(), hutTimeZone);

  // Says which hike is in the way, so the hiker can choose other times.
  const overlapError = async ({ hikerId, departureAt, returnAt }) => {
    const other = await hikes.findOverlapping({ hikerId, departureAt, returnAt });
    if (other === null) return new ConflictError('The times overlap another hike', { code: 'HIKE_OVERLAP' });
    const { destination, departureAt: from, returnAt: to } = describeHike(other, toLocal);
    return new ConflictError(
      `The times overlap your hike to ${destination}, from ${from} to ${to}`,
      { code: 'HIKE_OVERLAP', details: { hike: { destination, departureAt: from, returnAt: to } } },
    );
  };

  return async ({ user, start, destination, route, passagePoints, departureAt, returnAt }) => {
    if (user.role !== ROLES.HIKER) throw new ForbiddenError('Only hikers can register a hike');

    const departure = toInstant(departureAt);
    const back = toInstant(returnAt);
    const thisMinute = Math.floor(clock.now().getTime() / MINUTE_MS) * MINUTE_MS;
    if (departure.getTime() < thisMinute) {
      throw new ValidationError('The departure cannot be in the past');
    }
    if (back.getTime() <= departure.getTime()) {
      throw new ValidationError('The return must be after the departure');
    }

    const saved = await hikes.insert({
      hikerId: user.id, start, destination, route, passagePoints, departureAt: departure, returnAt: back,
    });
    if (saved === null) throw await overlapError({ hikerId: user.id, departureAt: departure, returnAt: back });

    return { ...describeHike(saved, toLocal), registeredAt: toLocal(saved.createdAt) };
  };
};
