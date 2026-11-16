import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeChangeBookingAndNotify } from '../../src/usecases/changeBookingAndNotify.js';

const input = { user: { id: 7, role: 'HIKER' }, bookingId: 45, partySize: 3 };
const saved = {
  id: 45,
  date: '2090-11-06',
  startsAt: '12:00:00',
  endsAt: '13:00:00',
  partySize: 3,
  requirements: [{ diets: ['VEGAN'], allergies: [] }],
};
const details = { email: 'mara@example.com', firstName: 'Mara', lastName: 'Rossi' };

function setup() {
  const changeBooking = vi.fn().mockResolvedValue(saved);
  const bookings = { findConfirmationDetails: vi.fn().mockResolvedValue(details) };
  const mailer = { send: vi.fn().mockResolvedValue(undefined) };
  const clock = {
    now: vi.fn(() => new Date('2090-11-01T10:00:00Z')),
    localDateTime: vi.fn(() => '2090-11-01T11:00'),
  };
  return {
    changeBooking,
    bookings,
    mailer,
    clock,
    changeBookingAndNotify: makeChangeBookingAndNotify({
      changeBooking, bookings, mailer, clock, hutTimeZone: 'Europe/Rome',
    }),
  };
}

afterEach(() => vi.restoreAllMocks());

describe('changeBooking notification (MH-06)', () => {
  it('sends one email with the saved booking reference and updated details', async () => {
    const t = setup();

    await expect(t.changeBookingAndNotify(input)).resolves.toBe(saved);

    expect(t.changeBooking).toHaveBeenCalledExactlyOnceWith(input);
    expect(t.bookings.findConfirmationDetails).toHaveBeenCalledExactlyOnceWith(saved.id);
    expect(t.mailer.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      to: details.email,
      subject: 'Your booking has changed (QUOTA-00045)',
      text: expect.stringContaining('Booking reference: QUOTA-00045'),
      html: expect.any(String),
    }));
    const [email] = t.mailer.send.mock.calls[0];
    expect(email.text).toContain('Name: Mara Rossi');
    expect(email.text).toContain('Date: 6 November 2090');
    expect(email.text).toContain('Time: 12:00\u201313:00');
    expect(email.text).toContain('Party size: 3');
    expect(email.text).toContain('Changed on: 1 November 2090, 11:00');
    expect(email.text).toContain('Dietary needs:');
    expect(email.text).toContain('- 1 guest: Diet: Vegan');
  });

  it('does not send an email when the change is rejected', async () => {
    const t = setup();
    const failure = new Error('No seats');
    t.changeBooking.mockRejectedValue(failure);

    await expect(t.changeBookingAndNotify(input)).rejects.toBe(failure);

    expect(t.bookings.findConfirmationDetails).not.toHaveBeenCalled();
    expect(t.mailer.send).not.toHaveBeenCalled();
  });

  it('returns the saved booking and logs an email failure without undoing the change', async () => {
    const t = setup();
    const failure = new Error('SMTP unavailable');
    t.mailer.send.mockRejectedValue(failure);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(t.changeBookingAndNotify(input)).resolves.toBe(saved);

    expect(t.changeBooking).toHaveBeenCalledExactlyOnceWith(input);
    expect(t.mailer.send).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledExactlyOnceWith(
      'The email about the change of booking 45 was not sent:', failure,
    );
  });
});
