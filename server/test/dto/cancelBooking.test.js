import { describe, expect, it, vi } from 'vitest';
import { parseCancelBooking } from '../../src/dto/bookings.js';
import { makeCancelBookingController } from '../../src/controllers/bookings.js';
import { ValidationError } from '../../src/domain/errors.js';

describe('parseCancelBooking', () => {
  it.each(['1', '45', '2147483648', String(Number.MAX_SAFE_INTEGER)])('parses a positive safe ID %s', (bookingId) => {
    expect(parseCancelBooking({ bookingId })).toEqual({ bookingId: Number(bookingId) });
  });

  it.each([
    undefined, null, '', '0', '-1', 'abc', '1.5', '45abc', '1e2', '0x2a', '01', '+1',
    ' 45', '45 ', '1/2', 'NaN', 'Infinity', '9007199254740992', 45, {}, ['45'],
  ])('rejects invalid ID %j before invoking the cancellation use case', async (bookingId) => {
    expect(() => parseCancelBooking({ bookingId }))
      .toThrow(new ValidationError('bookingId must be a positive integer'));
    const cancelBookingAndNotify = vi.fn();
    const controller = makeCancelBookingController({ cancelBookingAndNotify });
    await expect(controller({ params: { bookingId }, user: { id: 7, role: 'HIKER' } }, {}))
      .rejects.toThrow(ValidationError);
    expect(cancelBookingAndNotify).not.toHaveBeenCalled();
  });

  it.each([undefined, null, {}])('rejects missing parameters %j', (params) => {
    expect(() => parseCancelBooking(params)).toThrow(ValidationError);
  });
});
