import { describe, expect, it } from 'vitest';
import { bookingClosesAt, isBookingOpen } from '../../src/domain/bookingWindow.js';

describe('isBookingOpen', () => {
  const meal = new Date('2026-10-28T11:00:00Z');

  it('is open up to 2 hours before the meal, that moment included', () => {
    expect(isBookingOpen(meal, new Date('2026-10-28T09:00:00Z'))).toBe(true);
    expect(isBookingOpen(meal, new Date('2026-10-27T11:00:00Z'))).toBe(true);
  });

  it('is closed from one millisecond later on, and after the meal started', () => {
    expect(isBookingOpen(meal, new Date('2026-10-28T09:00:00.001Z'))).toBe(false);
    expect(isBookingOpen(meal, new Date('2026-10-28T10:30:00Z'))).toBe(false);
    expect(isBookingOpen(meal, new Date('2026-10-28T12:00:00Z'))).toBe(false);
  });
});

describe('bookingClosesAt', () => {
  it('is 2 hours before the meal', () => {
    expect(bookingClosesAt(new Date('2026-10-28T11:00:00Z'))).toBe(new Date('2026-10-28T09:00:00Z').getTime());
  });
});
