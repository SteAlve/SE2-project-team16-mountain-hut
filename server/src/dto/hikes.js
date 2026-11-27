/**
 * DTO of the hikes (MH-20): validates the body of POST /api/hikes (wrong input throws a
 * ValidationError, 400) and shapes the hikes that go out. The start is optional: without it the hike
 * starts at the hut, and it goes out as null.
 *
 * The departure and the return are the local date and time of the hut: 'YYYY-MM-DDTHH:MM'. Whether
 * the return is after the departure and whether the hike overlaps another one are rules of the hut:
 * the use case decides.
 */
import { ValidationError } from '../domain/errors.js';
import { rejectUnknownFields, requireDate, requireObject, requireTime } from './fields.js';

const MAX_START_LENGTH = 100;
const MAX_DESTINATION_LENGTH = 100;
const MAX_ROUTE_LENGTH = 500;
const MAX_POINT_LENGTH = 100;
// There is no limit for the hiker in the mockup: this one only keeps a request from being enormous.
const MAX_POINTS = 100;
const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;

// A text that cannot be blank, without the spaces around it, at most `maxLength` characters. With
// `oneLine` it cannot have a line break either: the destination is the subject of the email and a
// passage point is a line of it.
const requireLimitedText = (value, field, maxLength, { oneLine = false } = {}) => {
  if (typeof value !== 'string' || value.trim() === '') throw new ValidationError(`${field} is required`);
  const text = value.trim();
  if (text.length > maxLength) throw new ValidationError(`${field} can be at most ${maxLength} characters`);
  if (oneLine && /[\r\n]/.test(text)) throw new ValidationError(`${field} must be on one line`);
  return text;
};

// An optional text of one line: null when it is not sent (or null), never blank when it is.
const optionalLine = (value, field, maxLength) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new ValidationError(`${field} must be a text`);
  if (value.trim() === '') throw new ValidationError(`${field} cannot be empty`);
  return requireLimitedText(value, field, maxLength, { oneLine: true });
};

// The passage points, in order. Optional: nothing, null or [] mean no passage points.
const requirePassagePoints = (value) => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ValidationError('passagePoints must be an array of text');
  if (value.length > MAX_POINTS) throw new ValidationError(`passagePoints can have at most ${MAX_POINTS} points`);
  return value.map((point) => requireLimitedText(point, 'Each passage point', MAX_POINT_LENGTH, { oneLine: true }));
};

// 'YYYY-MM-DDTHH:MM', a day that exists and a time of the day.
const requireLocalDateTime = (value, field) => {
  const match = typeof value === 'string' ? LOCAL_DATE_TIME.exec(value) : null;
  if (match === null) throw new ValidationError(`${field} must be a date and a time (YYYY-MM-DDTHH:MM)`);
  requireDate(match[1], field);
  requireTime(match[2], field);
  return value;
};

// POST /api/hikes: destination, route and the two times are required; the start (null: the hut) and
// the passage points are not.
export function parseRegisterHike(body) {
  requireObject(body);
  rejectUnknownFields(body, ['start', 'destination', 'route', 'passagePoints', 'departureAt', 'returnAt']);
  return {
    start: optionalLine(body.start, 'start', MAX_START_LENGTH),
    destination: requireLimitedText(body.destination, 'destination', MAX_DESTINATION_LENGTH, { oneLine: true }),
    route: requireLimitedText(body.route, 'route', MAX_ROUTE_LENGTH),
    passagePoints: requirePassagePoints(body.passagePoints),
    departureAt: requireLocalDateTime(body.departureAt, 'departureAt'),
    returnAt: requireLocalDateTime(body.returnAt, 'returnAt'),
  };
}

// A hike as the API shows it (the use cases already wrote the times as the local time of the hut).
export const toHikeDto = ({ id, start, destination, route, passagePoints, departureAt, returnAt }) => ({
  id, start, destination, route, passagePoints, departureAt, returnAt,
});
