// MH-05 Provide party requirements: the use cases that carry the dietary needs of a booking.
// No database and no SMTP server: the dao, the mailer and the clock are fakes.
import { describe, expect, it, vi } from 'vitest';
import { makeBookTable } from '../../src/usecases/bookTable.js';
import { makeCheckSlotOpen } from '../../src/usecases/checkSlotOpen.js';
import { makeCreateBooking } from '../../src/usecases/createBooking.js';
import { clock as realClock } from '../../src/clock.js';
import { ForbiddenError, ValidationError } from '../../src/domain/errors.js';

const ZONE = 'Europe/Rome';
const DATE = '2026-10-28';
const hiker = { id: 7, role: 'HIKER' };
const slotRow = { slotId: 12, serviceDate: DATE, startsAt: '12:00:00', endsAt: '13:00:00', tableSetId: 1 };
const clockAt = (now) => ({ now: () => now, at: realClock.at, localDateTime: realClock.localDateTime });

const line = (fields) => ({
  diets: [], otherDiet: null, allergies: [], otherAllergy: null, otherRequests: null, ...fields,
});
// The dao gives back the lines as saved, with the flag the database works out.
const saved = (requirements) => requirements.map((item) => ({
  ...item, hasAllergies: item.allergies.length > 0 || item.otherAllergy !== null,
}));

function setup({ now = new Date('2026-10-27T10:00:00Z'), create } = {}) {
  const calls = [];
  const lookups = { slot: 0, tables: 0, duplicate: 0 };
  const slots = {
    findById: async () => { lookups.slot += 1; return slotRow; },
    findAvailableTablesBySlotId: async () => {
      lookups.tables += 1;
      return [{ tableId: 1, tableNumber: 10, freeSeats: 6 }, { tableId: 2, tableNumber: 20, freeSeats: 4 }];
    },
  };
  const bookings = {
    hasActiveBooking: async () => { lookups.duplicate += 1; return false; },
    createWithTableAssignments: async (input) => {
      calls.push(input);
      if (create) return create(input);
      return { id: 45, slotId: input.slotId, partySize: input.partySize, requirements: saved(input.requirements) };
    },
  };
  const checkSlotOpen = makeCheckSlotOpen({ clock: clockAt(now), hutTimeZone: ZONE });
  return {
    calls,
    lookups,
    book: (input = {}) => makeCreateBooking({ slots, bookings, checkSlotOpen })({
      user: hiker, slotId: 12, partySize: 3, tables: [{ tableNumber: 20, seats: 3 }], ...input,
    }),
  };
}

describe('createBooking with dietary needs (MH-05)', () => {
  const story = [
    line({ diets: ['VEGAN'], allergies: ['PEANUTS'] }),
    line({ allergies: ['SHELLFISH'] }),
    line({ diets: ['VEGETARIAN'] }),
  ];

  it('gives the dao the lines it was given, with the booking, so they are saved together', async () => {
    const t = setup();
    await t.book({ requirements: story });
    expect(t.calls).toEqual([{
      hikerId: 7,
      slotId: 12,
      partySize: 3,
      tableAssignments: [{ tableId: 2, seatCount: 3 }],
      requirements: story,
    }]);
  });

  it('answers with the lines as saved, each with its allergies flag', async () => {
    const t = setup();
    const booking = await t.book({ requirements: story });
    expect(booking.requirements).toEqual([
      { ...story[0], hasAllergies: true },
      { ...story[1], hasAllergies: true },
      { ...story[2], hasAllergies: false },
    ]);
    expect(booking).toMatchObject({ id: 45, slotId: 12, partySize: 3 });
  });

  it('flags the line that has only an other allergy written in words', async () => {
    const t = setup();
    const booking = await t.book({ requirements: [line({ otherAllergy: 'Kiwi' })] });
    expect(booking.requirements).toEqual([{ ...line({ otherAllergy: 'Kiwi' }), hasAllergies: true }]);
  });

  it('has no lines when none are given: the booking is the same as before MH-05', async () => {
    const t = setup();
    const booking = await t.book();
    expect(t.calls[0].requirements).toEqual([]);
    expect(booking.requirements).toEqual([]);
  });

  it('keeps the tables and the party as the preview says, whatever the lines', async () => {
    const t = setup();
    const booking = await t.book({ requirements: story });
    expect(booking.tables).toEqual([{ tableNumber: 20, seats: 3 }]);
    expect(booking.partySize).toBe(3);
    expect(booking.date).toBe(DATE);
  });

  it('uses the lines that the dao saved, not the ones it was given', async () => {
    const t = setup({
      create: (input) => ({
        id: 45, slotId: input.slotId, partySize: input.partySize, requirements: [{ ...story[2], hasAllergies: false }],
      }),
    });
    const booking = await t.book({ requirements: story });
    expect(booking.requirements).toEqual([{ ...story[2], hasAllergies: false }]);
  });

  it.each([
    ['an unknown diet', [line({ diets: ['KETO'] })], 'diets can contain only VEGETARIAN, VEGAN, PESCATARIAN, LACTOSE_FREE'],
    ['an unknown allergy', [line({ allergies: ['KIWI'] })], 'allergies can contain only GLUTEN, MILK, EGGS, PEANUTS, TREE_NUTS, FISH, SHELLFISH'],
    ['diets that exclude each other', [line({ diets: ['VEGAN', 'PESCATARIAN'] })], 'A guest can follow only one of VEGETARIAN, VEGAN, PESCATARIAN'],
    ['one wrong line among good ones', [story[0], line({ diets: ['KETO'] }), story[2]], 'diets can contain only VEGETARIAN, VEGAN, PESCATARIAN, LACTOSE_FREE'],
  ])('answers 400 for %s and books nothing', async (_name, requirements, message) => {
    const t = setup();
    await expect(t.book({ requirements })).rejects.toThrow(new ValidationError(message));
    expect(t.calls).toHaveLength(0);
  });

  it('checks the lines before it reads the slot, the tables or the other bookings', async () => {
    const t = setup();
    await expect(t.book({ requirements: [line({ diets: ['KETO'] })] })).rejects.toBeInstanceOf(ValidationError);
    expect(t.lookups).toEqual({ slot: 0, tables: 0, duplicate: 0 });
  });

  it('does not let the staff roles book for themselves, with or without lines', async () => {
    const t = setup();
    await expect(t.book({ user: { id: 1, role: 'EMPLOYEE' }, requirements: story })).rejects.toBeInstanceOf(ForbiddenError);
    expect(t.calls).toHaveLength(0);
  });

  it('does not hide an error of the dao that has to do with the lines', async () => {
    const failure = new TypeError('Each requirement needs diets, allergies, otherDiet, otherAllergy and otherRequests.');
    const t = setup({ create: () => { throw failure; } });
    await expect(t.book({ requirements: story })).rejects.toBe(failure);
  });
});

describe('bookTable: the dietary needs in the confirmation email (MH-05)', () => {
  const input = { user: hiker, slotId: 12, partySize: 3, tables: [{ tableNumber: 3, seats: 3 }] };
  const details = {
    bookingId: 45, firstName: 'Mara', lastName: 'Rossi', email: 'mara@example.com',
    date: '2090-11-04', startsAt: '12:00:00', endsAt: '13:00:00', partySize: 3,
  };

  function setupEmail(requirements) {
    const createBooking = vi.fn().mockResolvedValue({
      id: 45, date: details.date, slotId: 12, partySize: 3, tables: input.tables, requirements,
    });
    const bookings = { findConfirmationDetails: vi.fn().mockResolvedValue(details) };
    const mailer = { send: vi.fn().mockResolvedValue(undefined) };
    return { mailer, book: () => makeBookTable({ createBooking, bookings, mailer })(input) };
  }

  it('writes in the email the lines that the booking saved', async () => {
    const t = setupEmail(saved([
      line({ diets: ['VEGAN'], allergies: ['PEANUTS'] }),
      line({ allergies: ['SHELLFISH'] }),
      line({ diets: ['VEGETARIAN'] }),
    ]));

    await t.book();

    expect(t.mailer.send).toHaveBeenCalledTimes(1);
    const [email] = t.mailer.send.mock.calls[0];
    expect(email.text).toContain('Dietary needs:');
    expect(email.text).toContain('- 1 guest: Allergies: Peanuts · Diet: Vegan');
    expect(email.text).toContain('- 1 guest: Allergies: Shellfish');
    expect(email.text).toContain('- 1 guest: Diet: Vegetarian');
    expect(email.html).toContain('Dietary needs');
  });

  it('sends an email without the section when the booking has no lines', async () => {
    const t = setupEmail([]);
    await t.book();
    const [email] = t.mailer.send.mock.calls[0];
    expect(email.text).not.toContain('Dietary needs');
    expect(email.html).not.toContain('Dietary needs');
  });

  it('takes the lines from the saved booking, not from the details of the hiker and the slot', async () => {
    const createBooking = vi.fn().mockResolvedValue({
      id: 45, date: details.date, slotId: 12, partySize: 3, tables: input.tables,
      requirements: saved([line({ diets: ['PESCATARIAN'] })]),
    });
    const bookings = {
      findConfirmationDetails: vi.fn().mockResolvedValue({ ...details, requirements: saved([line({ diets: ['VEGAN'] })]) }),
    };
    const mailer = { send: vi.fn().mockResolvedValue(undefined) };

    await makeBookTable({ createBooking, bookings, mailer })(input);

    const [email] = mailer.send.mock.calls[0];
    expect(email.text).toContain('Diet: Pescatarian');
    expect(email.text).not.toContain('Vegan');
  });

  it('still returns the booking with its lines when the email fails', async () => {
    const requirements = saved([line({ allergies: ['EGGS'] })]);
    const t = setupEmail(requirements);
    t.mailer.send.mockRejectedValue(new Error('SMTP unavailable'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const booking = await t.book();

    expect(booking.requirements).toEqual(requirements);
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
});
