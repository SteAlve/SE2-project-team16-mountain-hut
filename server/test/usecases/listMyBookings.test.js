import { describe, expect, it, vi } from 'vitest';
import { clock as realClock } from '../../src/clock.js';
import { ForbiddenError } from '../../src/domain/errors.js';
import { makeListMyBookings } from '../../src/usecases/listMyBookings.js';

const user = { id: 7, role: 'HIKER' };
const zone = 'Europe/Rome';
const rows = [
  { id: 1, date: '2090-11-04', startsAt: '11:00:00', endsAt: '12:00:00' },
  { id: 2, date: '2090-11-04', startsAt: '14:00:00', endsAt: '15:00:00' },
  { id: 3, date: '2090-11-07', startsAt: '12:00:00', endsAt: '13:00:00' },
];

function listSetup(now = realClock.at('2090-11-04', '12:00', zone)) {
  const bookings = { findUpcomingByHiker: vi.fn().mockResolvedValue(rows) };
  const clock = {
    now: vi.fn(() => now),
    today: vi.fn((timeZone) => realClock.localDateTime(now.getTime(), timeZone).slice(0, 10)),
    at: vi.fn(realClock.at),
    localDateTime: vi.fn(realClock.localDateTime),
  };
  return {
    bookings,
    clock,
    listMyBookings: makeListMyBookings({ bookings, clock, hutTimeZone: zone }),
  };
}

describe('listMyBookings (MH-06)', () => {
  it('lists the hiker bookings from hut-local today and marks whether each can still change', async () => {
    const t = listSetup();

    await expect(t.listMyBookings({ user })).resolves.toEqual([
      { ...rows[0], canChange: false, changeableUntil: '2090-11-02T11:00' },
      { ...rows[1], canChange: false, changeableUntil: '2090-11-02T14:00' },
      { ...rows[2], canChange: true, changeableUntil: '2090-11-05T12:00' },
    ]);

    expect(t.clock.today).toHaveBeenCalledExactlyOnceWith(zone);
    expect(t.bookings.findUpcomingByHiker).toHaveBeenCalledExactlyOnceWith(user.id, '2090-11-04');
  });

  it('includes the exact 48-hour change deadline and closes one millisecond after it', async () => {
    const meal = realClock.at('2090-11-06', '12:00', zone);
    const atDeadline = listSetup(new Date(meal.getTime() - (48 * 60 * 60 * 1000)));
    const afterDeadline = listSetup(new Date(meal.getTime() - (48 * 60 * 60 * 1000) + 1));
    const oneBooking = [{ id: 4, date: '2090-11-06', startsAt: '12:00:00', endsAt: '13:00:00' }];
    atDeadline.bookings.findUpcomingByHiker.mockResolvedValue(oneBooking);
    afterDeadline.bookings.findUpcomingByHiker.mockResolvedValue(oneBooking);

    await expect(atDeadline.listMyBookings({ user })).resolves.toMatchObject([{ canChange: true }]);
    await expect(afterDeadline.listMyBookings({ user })).resolves.toMatchObject([{ canChange: false }]);
  });

  it('refuses to list bookings for a non-hiker without querying the bookings', async () => {
    const t = listSetup();

    await expect(t.listMyBookings({ user: { id: 8, role: 'EMPLOYEE' } }))
      .rejects.toEqual(new ForbiddenError('Only hikers have bookings'));

    expect(t.bookings.findUpcomingByHiker).not.toHaveBeenCalled();
  });
});
