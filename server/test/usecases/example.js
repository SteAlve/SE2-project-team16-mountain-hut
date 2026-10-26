/**
 * USE CASE TESTS: here go the tests of the use cases, named *.test.js. Build the use case with
 * hand-written fake objects instead of the dao: no database, no HTTP.
 *
 * THE CODE BELOW IS JUST AN EXAMPLE (story MH-01).
 * Delete this file when the first real one exists.
 */
import { describe, it, expect } from 'vitest';
import { makeBookTable } from '../../src/usecases/bookTable.js';
import { ConflictError } from '../../src/domain/errors.js';

describe('bookTable (use case, with fakes)', () => {
  it('refuses a booking less than 2 hours before the slot', async () => {
    const clock = { now: () => new Date('2026-07-10T09:00:00') };
    const slots = { findById: async () => ({ startsAt: new Date('2026-07-10T10:30:00') }) };
    const bookTable = makeBookTable({ slots, bookings: {}, clock });

    await expect(bookTable({ id: 1 }, { slotId: 3, partySize: 2 })).rejects.toThrow(ConflictError);
  });
});
