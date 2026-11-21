import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeCancelBookingAndNotify } from '../../src/usecases/cancelBookingAndNotify.js';
import { UnprocessableError } from '../../src/domain/errors.js';
import { clock as realClock } from '../../src/clock.js';

const input = { user: { id: 7, role: 'HIKER' }, bookingId: 45 };
const saved = { bookingId: 45, cancelledAt: new Date('2027-07-14T09:32:00Z') };
const details = {
  bookingId: 45, firstName: 'Giulia', lastName: 'Rossi', email: 'giulia@example.com',
  date: '2027-07-17', startsAt: '13:00:00', endsAt: '14:00:00', partySize: 4,
};

function setup(hutTimeZone = 'Europe/Rome') {
  const cancelBooking = vi.fn().mockResolvedValue(saved);
  const bookings = { findConfirmationDetails: vi.fn().mockResolvedValue(details) };
  const mailer = { send: vi.fn().mockResolvedValue(undefined) };
  const clock = { localDateTime: vi.fn(realClock.localDateTime) };
  return {
    cancelBooking, bookings, mailer, clock,
    cancel: makeCancelBookingAndNotify({ cancelBooking, bookings, mailer, clock, hutTimeZone }),
  };
}

afterEach(() => vi.restoreAllMocks());

describe('cancelBookingAndNotify (MH-08)', () => {
  it('sends exactly one email with the original booking details and returns the saved cancellation', async () => {
    const t = setup();
    expect(await t.cancel(input)).toBe(saved);
    expect(t.cancelBooking).toHaveBeenCalledExactlyOnceWith(input);
    expect(t.bookings.findConfirmationDetails).toHaveBeenCalledExactlyOnceWith(saved.bookingId);
    expect(t.mailer.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      to: details.email, subject: 'Your booking has been cancelled (QUOTA-00045)',
      html: expect.any(String), text: expect.any(String),
    }));
    const [email] = t.mailer.send.mock.calls[0];
    for (const [label, value] of [
      ['Booking reference', 'QUOTA-00045'], ['Name', 'Giulia Rossi'], ['Date', '17 July 2027'],
      ['Time', '13:00\u201314:00'], ['Party size', '4'], ['Cancelled on', '14 July 2027, 11:32'],
    ]) {
      expect(email.text).toContain(`${label}: ${value}`);
      expect(email.html).toContain(value);
    }
  });

  it.each([
    ['Europe/Rome', '2027-07-14T09:32:00Z', '14 July 2027, 11:32'],
    ['Europe/Rome', '2027-01-14T09:32:00Z', '14 January 2027, 10:32'],
    ['America/New_York', '2027-07-14T02:32:00Z', '13 July 2027, 22:32'],
  ])('formats %s cancellation time %s in the hut timezone', async (zone, instant, formatted) => {
    const t = setup(zone);
    const cancellation = { ...saved, cancelledAt: new Date(instant) };
    t.cancelBooking.mockResolvedValue(cancellation);
    await t.cancel(input);
    expect(t.clock.localDateTime).toHaveBeenCalledExactlyOnceWith(cancellation.cancelledAt.getTime(), zone);
    const [email] = t.mailer.send.mock.calls[0];
    expect(email.text).toContain(`Cancelled on: ${formatted}`);
    expect(email.html).toContain(formatted);
  });

  it('waits for successful persistence before looking up details or sending', async () => {
    const t = setup();
    const pending = Promise.withResolvers();
    t.cancelBooking.mockReturnValue(pending.promise);
    const result = t.cancel(input);
    await Promise.resolve();
    expect(t.bookings.findConfirmationDetails).not.toHaveBeenCalled();
    expect(t.mailer.send).not.toHaveBeenCalled();
    pending.resolve(saved);
    expect(await result).toBe(saved);
    expect(t.mailer.send).toHaveBeenCalledTimes(1);
  });

  it('propagates cancellation failure without looking up details, formatting time or sending', async () => {
    const t = setup();
    const failure = new Error('database unavailable');
    t.cancelBooking.mockRejectedValue(failure);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(t.cancel(input)).rejects.toBe(failure);
    expect(t.bookings.findConfirmationDetails).not.toHaveBeenCalled();
    expect(t.clock.localDateTime).not.toHaveBeenCalled();
    expect(t.mailer.send).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('does not send to a temporary hiker with no email', async () => {
    const t = setup();
    t.bookings.findConfirmationDetails.mockResolvedValue({ ...details, email: null });
    expect(await t.cancel(input)).toBe(saved);
    expect(t.mailer.send).not.toHaveBeenCalled();
    expect(t.clock.localDateTime).not.toHaveBeenCalled();
  });

  it.each(['mailer', 'details', 'clock'])('logs a %s failure while preserving the successful cancellation', async (stage) => {
    const t = setup();
    const failure = new Error(`${stage} unavailable`);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    if (stage === 'mailer') t.mailer.send.mockRejectedValue(failure);
    if (stage === 'details') t.bookings.findConfirmationDetails.mockRejectedValue(failure);
    if (stage === 'clock') t.clock.localDateTime.mockImplementation(() => { throw failure; });

    expect(await t.cancel(input)).toBe(saved);
    expect(t.cancelBooking).toHaveBeenCalledExactlyOnceWith(input);
    expect(t.mailer.send).toHaveBeenCalledTimes(stage === 'mailer' ? 1 : 0);
    expect(log).toHaveBeenCalledExactlyOnceWith(
      'The email about the cancellation of booking 45 was not sent:', failure,
    );
  });

  it('logs unexpectedly missing email details instead of treating them as delivery', async () => {
    const t = setup();
    t.bookings.findConfirmationDetails.mockResolvedValue(null);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await t.cancel(input)).toBe(saved);
    expect(t.mailer.send).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledExactlyOnceWith(
      'The email about the cancellation of booking 45 was not sent:', expect.any(TypeError),
    );
  });

  it('does not generate another notification when a second cancellation fails', async () => {
    const t = setup();
    const failure = new UnprocessableError('This booking was already cancelled');
    t.cancelBooking.mockResolvedValueOnce(saved).mockRejectedValueOnce(failure);
    await t.cancel(input);
    await expect(t.cancel(input)).rejects.toBe(failure);
    expect(t.bookings.findConfirmationDetails).toHaveBeenCalledTimes(1);
    expect(t.mailer.send).toHaveBeenCalledTimes(1);
  });
});
