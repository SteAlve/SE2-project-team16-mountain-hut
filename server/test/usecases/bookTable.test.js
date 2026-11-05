// MH-30 / MH-03: isolate the coordination of saving a booking and sending its confirmation.
// No database or SMTP server: each external dependency is a fake.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeBookTable } from '../../src/usecases/bookTable.js';

const input = { user: { id: 7, role: 'HIKER' }, slotId: 12, partySize: 2, tables: [{ tableNumber: 3, seats: 2 }] };
const saved = { id: 45, date: '2090-11-04', slotId: 12, partySize: 2, tables: input.tables };
const details = {
  bookingId: 45, firstName: 'Mara', lastName: 'Rossi', email: 'mara@example.com',
  date: saved.date, startsAt: '12:00:00', endsAt: '13:00:00', partySize: 2,
};

function setup() {
  const createBooking = vi.fn().mockResolvedValue(saved);
  const bookings = { findConfirmationDetails: vi.fn().mockResolvedValue(details) };
  const mailer = { send: vi.fn().mockResolvedValue(undefined) };
  return { createBooking, bookings, mailer, book: makeBookTable({ createBooking, bookings, mailer }) };
}

afterEach(() => vi.restoreAllMocks());

describe('bookTable confirmation (MH-03)', () => {
  it('sends one confirmation for the saved booking and returns the original result', async () => {
    const t = setup();

    expect(await t.book(input)).toBe(saved);

    expect(t.createBooking).toHaveBeenCalledExactlyOnceWith(input);
    expect(t.bookings.findConfirmationDetails).toHaveBeenCalledExactlyOnceWith(saved.id);
    expect(t.mailer.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      to: details.email,
      subject: 'Your table is booked (QUOTA-00045)',
      text: expect.stringContaining('Party size: 2'),
      html: expect.any(String),
    }));
    const [email] = t.mailer.send.mock.calls[0];
    for (const line of [
      'Booking reference: QUOTA-00045',
      'Name: Mara Rossi',
      'Date: 4 November 2090',
      'Time: 12:00\u201313:00',
      'Party size: 2',
    ]) {
      expect(email.text).toContain(line);
    }
    for (const value of ['QUOTA-00045', 'Mara Rossi', '4 November 2090', '12:00\u201313:00']) {
      expect(email.html).toContain(value);
    }
    expect(email.html).toMatch(/Party size<\/td>\s*<td\b[^>]*>2<\/td>/);
    for (const body of [email.text, email.html]) {
      expect(body).not.toMatch(/table\s*(number|n\.|#)?\s*\d/i);
    }
  });

  it('does not look up details or send an email until saving has completed', async () => {
    const t = setup();
    const save = Promise.withResolvers();
    t.createBooking.mockReturnValue(save.promise);

    const result = t.book(input);
    // Give an implementation that starts email work too early a chance to do so.
    await Promise.resolve();
    expect(t.createBooking).toHaveBeenCalledExactlyOnceWith(input);
    expect(t.bookings.findConfirmationDetails).not.toHaveBeenCalled();
    expect(t.mailer.send).not.toHaveBeenCalled();

    save.resolve(saved);
    expect(await result).toBe(saved);
    expect(t.bookings.findConfirmationDetails).toHaveBeenCalledExactlyOnceWith(saved.id);
    expect(t.mailer.send).toHaveBeenCalledTimes(1);
  });

  it('propagates a failed save without looking up details or sending an email', async () => {
    const t = setup();
    const failure = new Error('Database unavailable');
    t.createBooking.mockRejectedValue(failure);

    await expect(t.book(input)).rejects.toBe(failure);

    expect(t.bookings.findConfirmationDetails).not.toHaveBeenCalled();
    expect(t.mailer.send).not.toHaveBeenCalled();
  });

  it('returns the saved booking and logs an email failure without saving or sending again', async () => {
    const t = setup();
    const failure = new Error('SMTP unavailable');
    t.mailer.send.mockRejectedValue(failure);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(await t.book(input)).toBe(saved);

    expect(t.createBooking).toHaveBeenCalledExactlyOnceWith(input);
    expect(t.mailer.send).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledExactlyOnceWith(
      'The confirmation email of booking 45 was not sent:', failure,
    );
  });

  it('returns the saved booking and logs a failed details lookup without sending', async () => {
    const t = setup();
    const failure = new Error('Confirmation details unavailable');
    t.bookings.findConfirmationDetails.mockRejectedValue(failure);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(await t.book(input)).toBe(saved);

    expect(t.createBooking).toHaveBeenCalledExactlyOnceWith(input);
    expect(t.bookings.findConfirmationDetails).toHaveBeenCalledExactlyOnceWith(saved.id);
    expect(t.mailer.send).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledExactlyOnceWith(
      'The confirmation email of booking 45 was not sent:', failure,
    );
  });
});
