// MH-05 Provide party requirements: the dietary needs in the body of POST /api/bookings and in the
// booking that goes out. Which diets and allergies exist is a rule of the hut (domain/dietaryNeeds.js),
// so the DTO accepts any text there: the use case refuses the wrong codes.
import { describe, expect, it } from 'vitest';
import { parseCreateBooking, toBookingDto } from '../../src/dto/bookings.js';
import { ValidationError } from '../../src/domain/errors.js';

const base = {
  slotId: 12,
  partySize: 6,
  tables: [{ tableNumber: 3, seats: 4 }, { tableNumber: 5, seats: 2 }],
};
const parse = (requirements) => parseCreateBooking({ ...base, requirements });
const complete = (fields) => ({
  diets: [], otherDiet: null, allergies: [], otherAllergy: null, otherRequests: null, ...fields,
});

describe('parseCreateBooking: the requirements', () => {
  it('has no requirements when they are not sent', () => {
    expect(parseCreateBooking(base).requirements).toEqual([]);
  });

  it('accepts an empty list', () => {
    expect(parse([]).requirements).toEqual([]);
  });

  it('accepts the example of the API (three lines for three subsets of the party)', () => {
    expect(parse([
      { diets: ['VEGAN'], allergies: ['PEANUTS'] },
      { allergies: ['SHELLFISH'], otherRequests: 'No mushrooms, please' },
      { diets: ['VEGETARIAN', 'LACTOSE_FREE'] },
    ]).requirements).toEqual([
      complete({ diets: ['VEGAN'], allergies: ['PEANUTS'] }),
      complete({ allergies: ['SHELLFISH'], otherRequests: 'No mushrooms, please' }),
      complete({ diets: ['VEGETARIAN', 'LACTOSE_FREE'] }),
    ]);
  });

  it('fills what a line leaves out: no diets, no allergies and no text', () => {
    const [line] = parse([{ otherRequests: 'High chair' }]).requirements;
    expect(line).toEqual({
      diets: [], otherDiet: null, allergies: [], otherAllergy: null, otherRequests: 'High chair',
    });
  });

  it('takes null as a text that is not there', () => {
    const [line] = parse([{ diets: ['VEGAN'], otherDiet: null, otherAllergy: null, otherRequests: null }]).requirements;
    expect(line).toEqual(complete({ diets: ['VEGAN'] }));
  });

  it('accepts the other diet, the other allergy and the requests alone, one line each', () => {
    expect(parse([{ otherDiet: 'Halal' }, { otherAllergy: 'Kiwi' }, { otherRequests: 'Quiet table' }]).requirements)
      .toEqual([
        complete({ otherDiet: 'Halal' }),
        complete({ otherAllergy: 'Kiwi' }),
        complete({ otherRequests: 'Quiet table' }),
      ]);
  });

  it('trims the texts', () => {
    const [line] = parse([{ otherDiet: '  Halal ', otherAllergy: '\tKiwi\n', otherRequests: ' No onion  ' }]).requirements;
    expect(line).toMatchObject({ otherDiet: 'Halal', otherAllergy: 'Kiwi', otherRequests: 'No onion' });
  });

  it('keeps the order of the lines and of the codes', () => {
    const { requirements } = parse([
      { diets: ['LACTOSE_FREE', 'VEGAN'], allergies: ['EGGS', 'FISH', 'GLUTEN'] },
      { diets: ['PESCATARIAN'] },
    ]);
    expect(requirements[0]).toMatchObject({ diets: ['LACTOSE_FREE', 'VEGAN'], allergies: ['EGGS', 'FISH', 'GLUTEN'] });
    expect(requirements[1].diets).toEqual(['PESCATARIAN']);
  });

  it('accepts as many lines as people, one each', () => {
    const lines = Array.from({ length: 6 }, () => ({ diets: ['VEGAN'] }));
    expect(parse(lines).requirements).toHaveLength(6);
  });

  it('accepts the longest texts allowed (100 characters the other diet and the other allergy, 300 the requests)', () => {
    const [line] = parse([{
      otherDiet: 'd'.repeat(100), otherAllergy: 'a'.repeat(100), otherRequests: 'r'.repeat(300),
    }]).requirements;
    expect(line.otherDiet).toHaveLength(100);
    expect(line.otherAllergy).toHaveLength(100);
    expect(line.otherRequests).toHaveLength(300);
  });

  it('counts the length of a text without the spaces around it', () => {
    const [line] = parse([{ otherRequests: ` ${'r'.repeat(300)} ` }]).requirements;
    expect(line.otherRequests).toHaveLength(300);
  });

  it('does not copy back the other fields of the body: the tables and the slot stay as they were', () => {
    expect(parse([{ diets: ['VEGAN'] }])).toEqual({ ...base, requirements: [complete({ diets: ['VEGAN'] })] });
  });

  it('leaves to the domain the check of the codes: any text is a code for the DTO', () => {
    expect(parse([{ diets: ['KETO'], allergies: ['KIWI'] }]).requirements)
      .toEqual([complete({ diets: ['KETO'], allergies: ['KIWI'] })]);
  });
});

describe('parseCreateBooking: requirements that are refused', () => {
  const tooLong = (length) => 'x'.repeat(length);

  it.each([
    ['requirements that are not a list', { diets: ['VEGAN'] }, 'requirements must be an array'],
    ['requirements as text', 'vegan', 'requirements must be an array'],
    ['requirements that are null', null, 'requirements must be an array'],
    ['a line that is not an object', ['vegan'], 'Each requirement must be an object'],
    ['a line that is null', [null], 'Each requirement must be an object'],
    ['a line that is a list', [[{ diets: ['VEGAN'] }]], 'Each requirement must be an object'],
    ['a field that is not allowed in a line', [{ diets: ['VEGAN'], notes: 'x' }], 'Unknown field in requirements: notes'],
    ['hasAllergies: the server works it out', [{ allergies: ['EGGS'], hasAllergies: true }], 'Unknown field in requirements: hasAllergies'],
    ['a count of guests: a line is a guest', [{ diets: ['VEGAN'], guests: 2 }], 'Unknown field in requirements: guests'],
    ['diets that are not a list', [{ diets: 'VEGAN' }], 'diets must be an array of text'],
    ['a diet that is not text', [{ diets: [1] }], 'diets must be an array of text'],
    ['a diet that is null', [{ diets: [null] }], 'diets must be an array of text'],
    ['allergies that are not a list', [{ allergies: 'EGGS' }], 'allergies must be an array of text'],
    ['an allergy that is not text', [{ allergies: [{}] }], 'allergies must be an array of text'],
    ['the same diet twice', [{ diets: ['VEGAN', 'VEGAN'] }], 'The same value can appear only once in diets'],
    ['the same allergy twice', [{ allergies: ['EGGS', 'MILK', 'EGGS'] }], 'The same value can appear only once in allergies'],
    ['an empty line', [{}], 'Each requirement needs a diet, an allergy or a request'],
    ['a line with only empty lists', [{ diets: [], allergies: [] }], 'Each requirement needs a diet, an allergy or a request'],
    ['a line with only nulls', [{ otherDiet: null, otherAllergy: null, otherRequests: null }], 'Each requirement needs a diet, an allergy or a request'],
    ['an empty text', [{ otherRequests: '' }], 'otherRequests cannot be empty'],
    ['a text of spaces', [{ otherDiet: '   ' }], 'otherDiet cannot be empty'],
    ['an empty other allergy beside a valid diet', [{ diets: ['VEGAN'], otherAllergy: ' ' }], 'otherAllergy cannot be empty'],
    ['a text that is not text', [{ otherRequests: 5 }], 'otherRequests cannot be empty'],
    ['a text that is a list', [{ otherDiet: ['Halal'] }], 'otherDiet cannot be empty'],
    ['an other diet over 100 characters', [{ otherDiet: tooLong(101) }], 'otherDiet can be at most 100 characters'],
    ['an other allergy over 100 characters', [{ otherAllergy: tooLong(101) }], 'otherAllergy can be at most 100 characters'],
    ['requests over 300 characters', [{ otherRequests: tooLong(301) }], 'otherRequests can be at most 300 characters'],
  ])('rejects %s', (_name, requirements, message) => {
    expect(() => parse(requirements)).toThrow(new ValidationError(message));
  });

  it('rejects more lines than people: at most one line for each guest', () => {
    const lines = Array.from({ length: 7 }, () => ({ diets: ['VEGAN'] }));
    expect(() => parse(lines)).toThrow(
      new ValidationError('There can be at most one requirement per person of the party'),
    );
  });

  it('counts the people of the party of the same body', () => {
    const two = [{ diets: ['VEGAN'] }, { diets: ['VEGETARIAN'] }];
    expect(parseCreateBooking({ slotId: 1, partySize: 2, tables: [{ tableNumber: 1, seats: 2 }], requirements: two }).requirements)
      .toHaveLength(2);
    expect(() => parseCreateBooking({
      slotId: 1, partySize: 1, tables: [{ tableNumber: 1, seats: 1 }], requirements: two,
    })).toThrow(ValidationError);
  });

  it('does not accept the requirements of a body that has no valid party size', () => {
    expect(() => parseCreateBooking({ ...base, partySize: 0, requirements: [{ diets: ['VEGAN'] }] }))
      .toThrow(new ValidationError('partySize must be a positive integer'));
  });

  it('stops at the first wrong line', () => {
    expect(() => parse([{ diets: ['VEGAN'] }, {}, { diets: 'VEGAN' }]))
      .toThrow('Each requirement needs a diet, an allergy or a request');
  });
});

describe('toBookingDto: the requirements that go out', () => {
  const booking = {
    id: 5, date: '2026-10-28', slotId: 1, partySize: 6, tables: [{ tableNumber: 3, seats: 6 }],
  };

  it('has an empty list when the booking has no requirements', () => {
    expect(toBookingDto(booking).requirements).toEqual([]);
  });

  it('writes each line with its allergies flag, as saved', () => {
    const requirements = [
      { diets: ['VEGAN'], otherDiet: null, allergies: ['PEANUTS'], otherAllergy: null, otherRequests: null, hasAllergies: true },
      { diets: ['VEGETARIAN'], otherDiet: null, allergies: [], otherAllergy: null, otherRequests: 'Window', hasAllergies: false },
    ];
    expect(toBookingDto({ ...booking, requirements }).requirements).toEqual(requirements);
  });

  it('keeps only the fields of the API: nothing else of the line goes out', () => {
    const [line] = toBookingDto({
      ...booking,
      requirements: [{
        id: 99, bookingId: 5, diets: [], otherDiet: 'Halal', allergies: [], otherAllergy: null, otherRequests: null, hasAllergies: false,
      }],
    }).requirements;
    expect(Object.keys(line).sort()).toEqual(
      ['allergies', 'diets', 'hasAllergies', 'otherAllergy', 'otherDiet', 'otherRequests'],
    );
  });
});
