import { describe, expect, it, vi } from 'vitest';
import { makeCancelBooking } from '../../src/usecases/cancelBooking.js';
import { ForbiddenError, NotFoundError, UnprocessableError } from '../../src/domain/errors.js';

const user = { id: 7, role: 'HIKER' };
const bookingId = 45;
const now = new Date('2027-07-14T09:32:00Z');
const active = {
  id: bookingId, hikerId: user.id, cancelled: false,
  date: '2027-07-17', startsAt: '13:00:00', endsAt: '14:00:00', partySize: 4,
};

function setup(booking = active, instant = now) {
  const bookings = {
    findById: vi.fn().mockResolvedValue(booking),
    cancelBooking: vi.fn().mockResolvedValue(undefined),
  };
  const clock = { now: vi.fn().mockReturnValue(instant) };
  return { bookings, clock, cancel: makeCancelBooking({ bookings, clock }) };
}

describe('cancelBooking (MH-08)', () => {
  it('cancels the authenticated hiker’s booking once, with its ID and the injected instant', async () => {
    const t = setup();
    const result = await t.cancel({ user, bookingId });

    expect(t.bookings.findById).toHaveBeenCalledExactlyOnceWith(bookingId);
    expect(t.clock.now).toHaveBeenCalledTimes(1);
    expect(t.bookings.cancelBooking).toHaveBeenCalledExactlyOnceWith({ bookingId, cancelledAt: now });
    expect(result).toEqual({ bookingId, cancelledAt: now });
    expect(result.cancelledAt).toBe(now);
  });

  it.each([
    ['before the editing deadline', '2027-07-14T09:32:00Z'],
    ['exactly 48 hours before the meal', '2027-07-15T11:00:00Z'],
    ['one millisecond after the editing deadline', '2027-07-15T11:00:00.001Z'],
    ['less than 48 hours before the meal', '2027-07-17T10:00:00Z'],
    ['after the meal', '2027-07-18T09:32:00Z'],
  ])('allows cancellation %s', async (_label, timestamp) => {
    const cancelledAt = new Date(timestamp);
    const t = setup(active, cancelledAt);
    await expect(t.cancel({ user, bookingId })).resolves.toEqual({ bookingId, cancelledAt });
    expect(t.bookings.cancelBooking).toHaveBeenCalledExactlyOnceWith({ bookingId, cancelledAt });
  });

  it.each(['EMPLOYEE', 'WARDEN'])('rejects %s before reading or cancelling any booking (403)', async (role) => {
    const t = setup();
    await expect(t.cancel({ user: { ...user, role }, bookingId }))
      .rejects.toThrow(new ForbiddenError('Only hikers can cancel bookings'));
    expect(t.bookings.findById).not.toHaveBeenCalled();
    expect(t.bookings.cancelBooking).not.toHaveBeenCalled();
    expect(t.clock.now).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', null],
    ['owned by another hiker', { ...active, hikerId: 8 }],
    ['cancelled and owned by another hiker', { ...active, hikerId: 8, cancelled: true }],
  ])('hides a booking that is %s behind the same 404', async (_label, booking) => {
    const t = setup(booking);
    await expect(t.cancel({ user, bookingId })).rejects.toThrow(new NotFoundError('Booking 45 not found'));
    expect(t.bookings.cancelBooking).not.toHaveBeenCalled();
    expect(t.clock.now).not.toHaveBeenCalled();
  });

  it('rejects an already cancelled booking without calling the cancellation DAO (422)', async () => {
    const t = setup({ ...active, cancelled: true });
    await expect(t.cancel({ user, bookingId }))
      .rejects.toThrow(new UnprocessableError('This booking was already cancelled'));
    expect(t.bookings.cancelBooking).not.toHaveBeenCalled();
    expect(t.clock.now).not.toHaveBeenCalled();
  });

  it('translates a concurrent BOOKING_NOT_FOUND conflict into 422 without retrying', async () => {
    const t = setup();
    t.bookings.cancelBooking.mockRejectedValue(Object.assign(new RangeError('cancelled concurrently'), {
      code: 'BOOKING_NOT_FOUND',
    }));
    await expect(t.cancel({ user, bookingId }))
      .rejects.toThrow(new UnprocessableError('This booking was already cancelled'));
    expect(t.bookings.cancelBooking).toHaveBeenCalledTimes(1);
  });

  it.each(['findById', 'cancelBooking'])('propagates unexpected failures from %s', async (method) => {
    const t = setup();
    const failure = Object.assign(new Error('database unavailable'), { code: 'ECONNRESET' });
    t.bookings[method].mockRejectedValue(failure);
    await expect(t.cancel({ user, bookingId })).rejects.toBe(failure);
    expect(t.bookings.cancelBooking).toHaveBeenCalledTimes(method === 'findById' ? 0 : 1);
  });
});
