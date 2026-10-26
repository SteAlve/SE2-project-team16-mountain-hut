/**
 * DOMAIN TESTS: here go the tests of the business rules, named *.test.js. Call the pure functions
 * with plain values: no server, no database.
 *
 * THE CODE BELOW IS JUST AN EXAMPLE (story MH-01).
 * Delete this file when the first real one exists.
 */
import { describe, it, expect } from 'vitest';
import { isBookingOpen } from '../../src/domain/bookingWindow.js';

describe('isBookingOpen (domain)', () => {
  it('closes 2 hours before the slot', () => {
    const slotStart = new Date('2026-07-10T12:00:00');

    expect(isBookingOpen(slotStart, new Date('2026-07-10T10:00:00'))).toBe(true);
    expect(isBookingOpen(slotStart, new Date('2026-07-10T10:01:00'))).toBe(false);
  });
});
