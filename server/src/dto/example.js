/**
 * DTO: here goes the shape of the data crossing the HTTP boundary.
 * parseXxx(body) validates the request and throws a ValidationError (400); toXxxDto(obj) shapes the answer.
 * Not here: req/res, SQL, business rules, imports except domain/errors.js.
 *
 * THE CODE BELOW IS JUST AN EXAMPLE (story MH-01).
 * Delete this file when the first real one exists.
 */
import { ValidationError } from '../domain/errors.js';

export function parseBookTable(body) {
  const slotId = Number(body?.slotId);
  const partySize = Number(body?.partySize);
  if (!Number.isInteger(slotId) || slotId <= 0 || !Number.isInteger(partySize) || partySize <= 0) {
    throw new ValidationError('slotId and partySize must be positive integers');
  }
  return { slotId, partySize };
}

export const toBookingDto = ({ id, slotId, partySize }) => ({ id, slotId, partySize });
