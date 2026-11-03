import { afterEach, describe, expect, it, vi } from 'vitest';
import { clock } from '../src/clock.js';

const at = (date, time, zone) => clock.at(date, time, zone).toISOString();

describe('clock.at: the instant of a wall-clock time in a time zone', () => {
  it('uses the winter offset of Rome (UTC+1)', () => {
    expect(at('2026-10-28', '12:00', 'Europe/Rome')).toBe('2026-10-28T11:00:00.000Z');
    expect(at('2026-01-15', '12:00:00', 'Europe/Rome')).toBe('2026-01-15T11:00:00.000Z');
  });

  it('uses the summer offset of Rome (UTC+2)', () => {
    expect(at('2026-07-15', '12:00', 'Europe/Rome')).toBe('2026-07-15T10:00:00.000Z');
  });

  it('follows the day the clocks change (29 March 2026, 02:00 becomes 03:00)', () => {
    expect(at('2026-03-29', '01:30', 'Europe/Rome')).toBe('2026-03-29T00:30:00.000Z');
    expect(at('2026-03-29', '12:00', 'Europe/Rome')).toBe('2026-03-29T10:00:00.000Z');
  });

  it('follows the day the clocks change back (25 October 2026)', () => {
    expect(at('2026-10-25', '12:00', 'Europe/Rome')).toBe('2026-10-25T11:00:00.000Z');
    expect(at('2026-10-24', '12:00', 'Europe/Rome')).toBe('2026-10-24T10:00:00.000Z');
  });

  it('does not depend on the zone of the server', () => {
    expect(at('2026-10-28', '12:00', 'UTC')).toBe('2026-10-28T12:00:00.000Z');
    expect(at('2026-10-28', '12:00', 'America/New_York')).toBe('2026-10-28T16:00:00.000Z');
  });
});

describe('clock.after', () => {
  it('is now plus the milliseconds', () => {
    const before = Date.now();
    const instant = clock.after(1000).getTime();
    expect(instant).toBeGreaterThanOrEqual(before + 1000);
    expect(instant).toBeLessThanOrEqual(Date.now() + 1000);
  });
});

describe('clock.today: the day in a time zone', () => {
  afterEach(() => vi.useRealTimers());

  it('changes day at midnight of that zone, not of the server', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T23:30:00Z')); // 00:30 of the 29th in Rome

    expect(clock.today('Europe/Rome')).toBe('2026-10-29');
    expect(clock.today('UTC')).toBe('2026-10-28');
    expect(clock.today('America/New_York')).toBe('2026-10-28');
  });
});

describe('clock.localDateTime', () => {
  it('writes an instant as the local date and time of a zone', () => {
    const instant = new Date('2026-10-28T09:00:00Z').getTime();
    expect(clock.localDateTime(instant, 'Europe/Rome')).toBe('2026-10-28T10:00');
    expect(clock.localDateTime(instant, 'UTC')).toBe('2026-10-28T09:00');
  });

  it('writes midnight as 00:00 and follows the day', () => {
    expect(clock.localDateTime(new Date('2026-10-28T22:30:00Z').getTime(), 'Europe/Rome')).toBe('2026-10-28T23:30');
    expect(clock.localDateTime(new Date('2026-10-28T23:00:00Z').getTime(), 'Europe/Rome')).toBe('2026-10-29T00:00');
  });

  it('is the opposite of clock.at', () => {
    expect(clock.localDateTime(clock.at('2026-07-15', '12:00', 'Europe/Rome').getTime(), 'Europe/Rome')).toBe('2026-07-15T12:00');
  });
});
