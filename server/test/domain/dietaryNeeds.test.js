// MH-05 Provide party requirements: the rules of the hut about the dietary needs of a booking.
import { describe, expect, it } from 'vitest';
import { ALLERGIES, DIETS, checkDietaryNeeds } from '../../src/domain/dietaryNeeds.js';
import { ValidationError } from '../../src/domain/errors.js';

const line = (diets = [], allergies = []) => ({
  diets, otherDiet: null, allergies, otherAllergy: null, otherRequests: null,
});

describe('the preset lists', () => {
  it('has the diets of the mockup', () => {
    expect(DIETS).toEqual(['VEGETARIAN', 'VEGAN', 'PESCATARIAN', 'LACTOSE_FREE']);
  });

  it('has the allergies of the mockup', () => {
    expect(ALLERGIES).toEqual(['GLUTEN', 'MILK', 'EGGS', 'PEANUTS', 'TREE_NUTS', 'FISH', 'SHELLFISH']);
  });

  it('cannot be changed at run time', () => {
    expect(Object.isFrozen(DIETS)).toBe(true);
    expect(Object.isFrozen(ALLERGIES)).toBe(true);
  });
});

describe('checkDietaryNeeds: what is accepted', () => {
  it('accepts no lines at all', () => {
    expect(() => checkDietaryNeeds([])).not.toThrow();
  });

  it.each(DIETS)('accepts the diet %s', (diet) => {
    expect(() => checkDietaryNeeds([line([diet])])).not.toThrow();
  });

  it.each(ALLERGIES)('accepts the allergy %s', (allergy) => {
    expect(() => checkDietaryNeeds([line([], [allergy])])).not.toThrow();
  });

  it('accepts every allergy together on one line', () => {
    expect(() => checkDietaryNeeds([line([], [...ALLERGIES])])).not.toThrow();
  });

  it('accepts a diet and an allergy on the same line', () => {
    expect(() => checkDietaryNeeds([line(['VEGAN'], ['PEANUTS'])])).not.toThrow();
  });

  it('accepts lactose-free together with one of the diets that exclude each other', () => {
    for (const diet of ['VEGETARIAN', 'VEGAN', 'PESCATARIAN']) {
      expect(() => checkDietaryNeeds([line([diet, 'LACTOSE_FREE'])])).not.toThrow();
      expect(() => checkDietaryNeeds([line(['LACTOSE_FREE', diet])])).not.toThrow();
    }
  });

  it('accepts several lines, also with the same content (several guests with the same needs)', () => {
    expect(() => checkDietaryNeeds([
      line(['VEGAN'], ['PEANUTS']),
      line([], ['SHELLFISH']),
      line(['VEGETARIAN']),
      line(['VEGETARIAN']),
    ])).not.toThrow();
  });

  it('does not look at the words of the "other" fields and of the requests: they are free text', () => {
    expect(() => checkDietaryNeeds([{
      diets: [], otherDiet: 'Halal', allergies: [], otherAllergy: 'Kiwi', otherRequests: 'Anything, really',
    }])).not.toThrow();
  });
});

describe('checkDietaryNeeds: what is refused', () => {
  it.each([
    ['an unknown diet', line(['KETO']), `diets can contain only ${DIETS.join(', ')}`],
    ['a diet in lowercase', line(['vegan']), `diets can contain only ${DIETS.join(', ')}`],
    ['an allergy in the list of the diets', line(['PEANUTS']), `diets can contain only ${DIETS.join(', ')}`],
    ['an unknown allergy', line([], ['KIWI']), `allergies can contain only ${ALLERGIES.join(', ')}`],
    ['an allergy in lowercase', line([], ['peanuts']), `allergies can contain only ${ALLERGIES.join(', ')}`],
    ['a diet in the list of the allergies', line([], ['VEGAN']), `allergies can contain only ${ALLERGIES.join(', ')}`],
  ])('refuses %s with a ValidationError', (_name, requirement, message) => {
    expect(() => checkDietaryNeeds([requirement])).toThrow(new ValidationError(message));
  });

  it.each([
    [['VEGETARIAN', 'VEGAN']],
    [['VEGAN', 'VEGETARIAN']],
    [['VEGETARIAN', 'PESCATARIAN']],
    [['VEGAN', 'PESCATARIAN']],
    [['VEGETARIAN', 'VEGAN', 'PESCATARIAN']],
    [['VEGAN', 'LACTOSE_FREE', 'PESCATARIAN']],
  ])('refuses the diets %j on one guest: they exclude each other', (diets) => {
    expect(() => checkDietaryNeeds([line(diets)])).toThrow(
      new ValidationError('A guest can follow only one of VEGETARIAN, VEGAN, PESCATARIAN'),
    );
  });

  it('refuses the whole list when only one of the lines is wrong, whichever it is', () => {
    const wrong = line(['KETO']);
    expect(() => checkDietaryNeeds([wrong, line(['VEGAN'])])).toThrow(ValidationError);
    expect(() => checkDietaryNeeds([line(['VEGAN']), wrong])).toThrow(ValidationError);
    expect(() => checkDietaryNeeds([line(['VEGAN']), line([], ['EGGS']), wrong])).toThrow(ValidationError);
  });

  it('says the diets are wrong before it says they exclude each other', () => {
    expect(() => checkDietaryNeeds([line(['VEGAN', 'VEGETARIAN', 'KETO'])]))
      .toThrow(`diets can contain only ${DIETS.join(', ')}`);
  });
});
