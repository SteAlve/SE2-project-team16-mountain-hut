// MH-05 Provide party requirements: the dietary needs of a booking in the test database
// (booking_requirement, created by migration 002).
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { all, close, get, run } from '../../src/dao/db.js';
import * as bookings from '../../src/dao/bookings.js';
import * as slots from '../../src/dao/slots.js';
import { cleanBookingData, createHiker, createSlot } from '../helpers/bookingFixtures.js';

let hiker;
let other;

const clean = async () => {
  await cleanBookingData();
  await run("DELETE FROM app_user WHERE email LIKE '%@example.com'");
};

beforeEach(async () => {
  await clean();
  hiker = await createHiker('needs.hiker@example.com');
  other = await createHiker('needs.other@example.com');
});
afterAll(async () => {
  await clean();
  await close();
});

const line = (fields) => ({
  diets: [], otherDiet: null, allergies: [], otherAllergy: null, otherRequests: null, ...fields,
});

const book = (slot, who, partySize, tableAssignments, requirements) =>
  bookings.createWithTableAssignments({
    hikerId: who.id, slotId: slot.slotId, partySize, tableAssignments, requirements,
  });

const oneTable = (slot, seatCount) => [{ tableId: slot.tableIds[0], seatCount }];
const rowsOf = (bookingId) => all(
  'SELECT diets, other_diet AS "otherDiet", allergies, other_allergy AS "otherAllergy", other_requests AS "otherRequests", has_allergies AS "hasAllergies" FROM booking_requirement WHERE booking_id = $1 ORDER BY id',
  [bookingId],
);

describe('saving the dietary needs with the booking', () => {
  it('saves the three lines of the story, one row each, in the order they were given', async () => {
    const slot = await createSlot({ seats: [6] });
    const lines = [
      line({ diets: ['VEGAN'], allergies: ['PEANUTS'] }),
      line({ allergies: ['SHELLFISH'] }),
      line({ diets: ['VEGETARIAN'] }),
    ];

    const booking = await book(slot, hiker, 4, oneTable(slot, 4), lines);

    expect(await rowsOf(booking.id)).toEqual([
      { ...lines[0], hasAllergies: true },
      { ...lines[1], hasAllergies: true },
      { ...lines[2], hasAllergies: false },
    ]);
  });

  it('returns the lines as saved, with the flag of each', async () => {
    const slot = await createSlot({ seats: [6] });
    const booking = await book(slot, hiker, 3, oneTable(slot, 3), [
      line({ diets: ['PESCATARIAN', 'LACTOSE_FREE'], allergies: ['EGGS', 'MILK'] }),
      line({ otherRequests: 'High chair' }),
    ]);

    expect(booking.requirements).toEqual([
      { diets: ['PESCATARIAN', 'LACTOSE_FREE'], otherDiet: null, allergies: ['EGGS', 'MILK'], otherAllergy: null, otherRequests: null, hasAllergies: true },
      { diets: [], otherDiet: null, allergies: [], otherAllergy: null, otherRequests: 'High chair', hasAllergies: false },
    ]);
  });

  it('saves the texts written in words', async () => {
    const slot = await createSlot({ seats: [4] });
    const booking = await book(slot, hiker, 1, oneTable(slot, 1), [
      line({ otherDiet: 'Halal', otherAllergy: 'Kiwi', otherRequests: 'No mushrooms, please' }),
    ]);

    expect(await rowsOf(booking.id)).toEqual([{
      diets: [], otherDiet: 'Halal', allergies: [], otherAllergy: 'Kiwi', otherRequests: 'No mushrooms, please', hasAllergies: true,
    }]);
  });

  it('saves no rows when the booking has no needs, also when they are not given', async () => {
    const slot = await createSlot({ seats: [6] });
    const without = await book(slot, hiker, 1, oneTable(slot, 1));
    const empty = await book(slot, other, 1, oneTable(slot, 1), []);

    expect(without.requirements).toEqual([]);
    expect(empty.requirements).toEqual([]);
    expect(await rowsOf(without.id)).toEqual([]);
    expect(await rowsOf(empty.id)).toEqual([]);
  });

  it('keeps the needs of each booking apart, also in the same slot', async () => {
    const slot = await createSlot({ seats: [6] });
    const first = await book(slot, hiker, 2, oneTable(slot, 2), [line({ diets: ['VEGAN'] })]);
    const second = await book(slot, other, 2, oneTable(slot, 2), [line({ allergies: ['GLUTEN'] }), line({ otherRequests: 'Quiet' })]);

    expect(await rowsOf(first.id)).toHaveLength(1);
    expect((await rowsOf(first.id))[0]).toMatchObject({ diets: ['VEGAN'], hasAllergies: false });
    expect(await rowsOf(second.id)).toHaveLength(2);
    expect((await rowsOf(second.id))[0]).toMatchObject({ allergies: ['GLUTEN'], hasAllergies: true });
  });

  it('saves the same line more than once when several guests have the same needs', async () => {
    const slot = await createSlot({ seats: [6] });
    const same = line({ diets: ['VEGETARIAN'] });
    const booking = await book(slot, hiker, 3, oneTable(slot, 3), [same, { ...same }]);
    expect(await rowsOf(booking.id)).toHaveLength(2);
  });
});

describe('the allergies flag', () => {
  const flagOf = async (fields) => {
    const slot = await createSlot({ seats: [4] });
    const booking = await book(slot, hiker, 1, oneTable(slot, 1), [line(fields)]);
    return booking.requirements[0].hasAllergies;
  };

  it('is checked when the guest has a preset allergy', async () => {
    expect(await flagOf({ allergies: ['TREE_NUTS'] })).toBe(true);
  });

  it('is checked when the guest has only an allergy written in words', async () => {
    expect(await flagOf({ otherAllergy: 'Kiwi' })).toBe(true);
  });

  it('is not checked for a diet, an other diet or a request', async () => {
    expect(await flagOf({ diets: ['VEGAN'] })).toBe(false);
    expect(await flagOf({ otherDiet: 'Halal' })).toBe(false);
    expect(await flagOf({ otherRequests: 'Near the window' })).toBe(false);
  });

  it('cannot be written by the caller: the database works it out from the allergies', async () => {
    const slot = await createSlot({ seats: [4] });
    const booking = await book(slot, hiker, 1, oneTable(slot, 1), [{ ...line({ diets: ['VEGAN'] }), hasAllergies: true }]);
    expect(booking.requirements[0].hasAllergies).toBe(false);

    await expect(run(
      'INSERT INTO booking_requirement (booking_id, diets, has_allergies) VALUES ($1, $2, TRUE)',
      [booking.id, ['VEGAN']],
    )).rejects.toThrow();
  });
});

describe('findRequirements', () => {
  it('gives the lines of a booking in the order the hiker added them, with the flag', async () => {
    const slot = await createSlot({ seats: [6] });
    const lines = [
      line({ otherRequests: 'First' }),
      line({ allergies: ['FISH'] }),
      line({ diets: ['VEGAN'] }),
      line({ otherAllergy: 'Kiwi' }),
    ];
    const booking = await book(slot, hiker, 4, oneTable(slot, 4), lines);

    expect(await bookings.findRequirements(booking.id)).toEqual([
      { ...lines[0], hasAllergies: false },
      { ...lines[1], hasAllergies: true },
      { ...lines[2], hasAllergies: false },
      { ...lines[3], hasAllergies: true },
    ]);
  });

  it('gives an empty list for a booking without needs and for a booking that does not exist', async () => {
    const slot = await createSlot({ seats: [4] });
    const booking = await book(slot, hiker, 1, oneTable(slot, 1));
    expect(await bookings.findRequirements(booking.id)).toEqual([]);
    expect(await bookings.findRequirements(999999999)).toEqual([]);
  });

  it('does not give the lines of another booking', async () => {
    const slot = await createSlot({ seats: [6] });
    const first = await book(slot, hiker, 1, oneTable(slot, 1), [line({ diets: ['VEGAN'] })]);
    const second = await book(slot, other, 1, oneTable(slot, 1), [line({ allergies: ['EGGS'] })]);

    expect(await bookings.findRequirements(first.id)).toEqual([{ ...line({ diets: ['VEGAN'] }), hasAllergies: false }]);
    expect(await bookings.findRequirements(second.id)).toEqual([{ ...line({ allergies: ['EGGS'] }), hasAllergies: true }]);
  });
});

describe('the booking and its needs are saved together', () => {
  it('saves nothing, and keeps the seats free, when a line is refused by the database', async () => {
    const slot = await createSlot({ seats: [4] });
    // A code that the dao does not know about reaches the CHECK of the table: the whole booking goes back.
    await expect(book(slot, hiker, 2, oneTable(slot, 2), [
      line({ diets: ['VEGAN'] }),
      line({ diets: ['KETO'] }),
    ])).rejects.toThrow();

    expect(await get('SELECT COUNT(*)::INT AS n FROM booking WHERE slot_id = $1', [slot.slotId])).toEqual({ n: 0 });
    expect(await get('SELECT COUNT(*)::INT AS n FROM booking_table WHERE slot_id = $1', [slot.slotId])).toEqual({ n: 0 });
    expect(await get(
      'SELECT COUNT(*)::INT AS n FROM booking_requirement WHERE booking_id IN (SELECT id FROM booking WHERE hiker_id = $1)',
      [hiker.id],
    )).toEqual({ n: 0 });
    expect(await slots.findAvailableTablesBySlotId(slot.slotId)).toEqual([
      { tableId: slot.tableIds[0], tableNumber: 1, seatCapacity: 4, freeSeats: 4 },
    ]);
    expect(await bookings.hasActiveBooking(hiker.id, slot.slotId)).toBe(false);
  });

  it('can book again after a refused line', async () => {
    const slot = await createSlot({ seats: [4] });
    await expect(book(slot, hiker, 1, oneTable(slot, 1), [line({ allergies: ['KIWI'] })])).rejects.toThrow();
    const booking = await book(slot, hiker, 1, oneTable(slot, 1), [line({ allergies: ['EGGS'] })]);
    expect(booking.requirements).toHaveLength(1);
  });

  it('saves no needs when the seats are not free any more', async () => {
    const slot = await createSlot({ seats: [2] });
    await book(slot, hiker, 2, oneTable(slot, 2));

    await expect(book(slot, other, 1, oneTable(slot, 1), [line({ diets: ['VEGAN'] })]))
      .rejects.toMatchObject({ code: 'SEATS_UNAVAILABLE' });

    expect(await get(
      'SELECT COUNT(*)::INT AS n FROM booking_requirement WHERE booking_id IN (SELECT id FROM booking WHERE hiker_id = $1)',
      [other.id],
    )).toEqual({ n: 0 });
  });

  it('saves no needs when the hiker already has a booking for the slot', async () => {
    const slot = await createSlot({ seats: [6] });
    const first = await book(slot, hiker, 1, oneTable(slot, 1), [line({ diets: ['VEGAN'] })]);

    await expect(book(slot, hiker, 1, oneTable(slot, 1), [line({ diets: ['VEGETARIAN'] })]))
      .rejects.toMatchObject({ code: 'DUPLICATE_BOOKING' });

    expect(await rowsOf(first.id)).toHaveLength(1);
    expect(await get(
      'SELECT COUNT(*)::INT AS n FROM booking_requirement WHERE booking_id IN (SELECT id FROM booking WHERE hiker_id = $1)',
      [hiker.id],
    )).toEqual({ n: 1 });
  });
});

describe('the lines the dao refuses before it touches the database', () => {
  const attempt = async (requirements) => {
    const slot = await createSlot({ seats: [4] });
    return { slot, result: book(slot, hiker, 1, oneTable(slot, 1), requirements) };
  };

  it.each([
    ['requirements that are not a list', { diets: ['VEGAN'] }, 'requirements must be an array.'],
    ['requirements that are null', null, 'requirements must be an array.'],
    ['a line that is null', [null], 'Each requirement needs diets, allergies, otherDiet, otherAllergy and otherRequests.'],
    ['a line without the lists', [{ otherRequests: 'x' }], 'Each requirement needs diets, allergies, otherDiet, otherAllergy and otherRequests.'],
    ['a line whose diets are not a list', [{ ...line({}), diets: 'VEGAN' }], 'Each requirement needs diets, allergies, otherDiet, otherAllergy and otherRequests.'],
    ['a line with an undefined text', [{ ...line({}), otherDiet: undefined }], 'Each requirement needs diets, allergies, otherDiet, otherAllergy and otherRequests.'],
    ['a line with a text that is not text', [{ ...line({ diets: ['VEGAN'] }), otherRequests: 4 }], 'Each requirement needs diets, allergies, otherDiet, otherAllergy and otherRequests.'],
    ['an empty line', [line({})], 'Each requirement needs at least one need or a request.'],
  ])('throws a TypeError for %s', async (_name, requirements, message) => {
    const { slot, result } = await attempt(requirements);
    await expect(result).rejects.toThrow(new TypeError(message));
    expect(await get('SELECT COUNT(*)::INT AS n FROM booking WHERE slot_id = $1', [slot.slotId])).toEqual({ n: 0 });
  });
});

describe('the table of the needs', () => {
  it('is removed with its booking', async () => {
    const slot = await createSlot({ seats: [4] });
    const booking = await book(slot, hiker, 2, oneTable(slot, 2), [line({ diets: ['VEGAN'] }), line({ allergies: ['EGGS'] })]);
    expect(await rowsOf(booking.id)).toHaveLength(2);

    await run('DELETE FROM booking WHERE id = $1', [booking.id]);

    expect(await rowsOf(booking.id)).toEqual([]);
  });

  it('does not take a line with nothing in it', async () => {
    const slot = await createSlot({ seats: [4] });
    const booking = await book(slot, hiker, 1, oneTable(slot, 1));
    await expect(run('INSERT INTO booking_requirement (booking_id) VALUES ($1)', [booking.id])).rejects.toThrow();
  });

  it.each([
    ['an other diet that is blank', 'other_diet'],
    ['an other allergy that is blank', 'other_allergy'],
    ['requests that are blank', 'other_requests'],
  ])('does not take %s', async (_name, column) => {
    const slot = await createSlot({ seats: [4] });
    const booking = await book(slot, hiker, 1, oneTable(slot, 1));
    await expect(run(
      `INSERT INTO booking_requirement (booking_id, diets, ${column}) VALUES ($1, '{VEGAN}', '   ')`,
      [booking.id],
    )).rejects.toThrow();
  });

  it.each([
    ['an other diet', 'other_diet', 101],
    ['an other allergy', 'other_allergy', 101],
    ['requests', 'other_requests', 301],
  ])('does not take %s that is too long', async (_name, column, length) => {
    const slot = await createSlot({ seats: [4] });
    const booking = await book(slot, hiker, 1, oneTable(slot, 1));
    await expect(run(
      `INSERT INTO booking_requirement (booking_id, ${column}) VALUES ($1, $2)`,
      [booking.id, 'x'.repeat(length)],
    )).rejects.toThrow();
  });

  it('takes the longest texts allowed', async () => {
    const slot = await createSlot({ seats: [4] });
    const booking = await book(slot, hiker, 1, oneTable(slot, 1), [
      line({ otherDiet: 'd'.repeat(100), otherAllergy: 'a'.repeat(100), otherRequests: 'r'.repeat(300) }),
    ]);
    expect(booking.requirements[0].otherRequests).toHaveLength(300);
  });
});
