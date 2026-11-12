import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  countGuests,
  emptyLine,
  groupRequirements,
  guests,
  lineChips,
  lineErrors,
  needChips,
  OTHER,
  toggleAllergy,
  toggleDiet,
  toRequirements,
} from '../src/lib/dietaryNeeds.js';

const line = (changes) => ({ ...emptyLine(1), ...changes });

test('a new line is one guest with nothing chosen', () => {
  assert.deepEqual(emptyLine(7), {
    key: 7, guests: 1, diets: [], otherDiet: '', allergies: [], otherAllergy: '', otherRequests: '',
  });
  assert.equal(guests(1), '1 guest');
  assert.equal(guests(3), '3 guests');
});

test('the guests of all the lines are counted', () => {
  assert.equal(countGuests([]), 0);
  assert.equal(countGuests([line({ guests: 3 }), line({ guests: 1 })]), 4);
});

test('Vegetarian, Vegan and Pescatarian exclude each other; Lactose-free goes with any', () => {
  let l = toggleDiet(line(), 'VEGETARIAN');
  l = toggleDiet(l, 'LACTOSE_FREE');
  assert.deepEqual(l.diets, ['VEGETARIAN', 'LACTOSE_FREE']);
  l = toggleDiet(l, 'VEGAN');
  assert.deepEqual(l.diets, ['LACTOSE_FREE', 'VEGAN']);
  l = toggleDiet(l, 'VEGAN');
  assert.deepEqual(l.diets, ['LACTOSE_FREE']);
});

test('any number of allergies; tapping again unselects', () => {
  let l = toggleAllergy(line(), 'PEANUTS');
  l = toggleAllergy(l, 'GLUTEN');
  assert.deepEqual(l.allergies, ['PEANUTS', 'GLUTEN']);
  assert.deepEqual(toggleAllergy(l, 'PEANUTS').allergies, ['GLUTEN']);
});

test('a line with no card and no request cannot be sent', () => {
  assert.ok(lineErrors(line()).line);
  assert.ok(lineErrors(line({ otherRequests: '   ' })).line);
  assert.deepEqual(lineErrors(line({ otherRequests: 'No spicy food' })), {});
  assert.deepEqual(lineErrors(line({ diets: ['VEGAN'] })), {});
});

test('Other needs its text, at most 100 characters', () => {
  assert.equal(lineErrors(line({ allergies: [OTHER] })).otherAllergy, 'Write which allergy, or unselect Other.');
  assert.equal(lineErrors(line({ diets: [OTHER], otherDiet: '  ' })).otherDiet, 'Write which diet, or unselect Other.');
  assert.equal(lineErrors(line({ allergies: [OTHER], otherAllergy: 'x'.repeat(101) })).otherAllergy, 'Too long: at most 100 characters.');
  assert.deepEqual(lineErrors(line({ allergies: [OTHER], otherAllergy: 'x'.repeat(100) })), {});
  // A text left behind by an unselected Other is not checked and not sent.
  assert.deepEqual(lineErrors(line({ diets: ['VEGAN'], otherDiet: 'x'.repeat(200) })), {});
});

test('other requests are at most 300 characters', () => {
  const errors = lineErrors(line({ diets: ['VEGAN'], otherRequests: 'x'.repeat(301) }));
  assert.equal(errors.otherRequests, 'Too long: at most 300 characters.');
});

test('a line of N guests becomes N equal requirements, in the order of the lines', () => {
  const lines = [
    line({ guests: 1, diets: ['VEGAN'], allergies: ['PEANUTS'] }),
    line({ guests: 2, diets: ['VEGETARIAN', OTHER], otherDiet: ' halal ', otherRequests: ' ' }),
    line({ guests: 1, allergies: [OTHER], otherAllergy: 'sesame', otherRequests: ' No mushrooms ', otherDiet: 'unused' }),
  ];
  assert.deepEqual(toRequirements(lines), [
    { diets: ['VEGAN'], allergies: ['PEANUTS'] },
    { diets: ['VEGETARIAN'], allergies: [], otherDiet: 'halal' },
    { diets: ['VEGETARIAN'], allergies: [], otherDiet: 'halal' },
    { diets: [], allergies: [], otherAllergy: 'sesame', otherRequests: 'No mushrooms' },
  ]);
});

test('chips show the allergies first, then the diets; Other shows its text', () => {
  assert.deepEqual(lineChips(line({ diets: ['VEGAN'], allergies: ['PEANUTS', OTHER], otherAllergy: 'sesame' })), [
    { kind: 'allergy', name: 'Peanuts' },
    { kind: 'allergy', name: 'sesame' },
    { kind: 'diet', name: 'Vegan' },
  ]);
  assert.deepEqual(lineChips(line({ diets: [OTHER] })), [{ kind: 'diet', name: 'Other' }]);
  assert.deepEqual(
    needChips({ diets: ['LACTOSE_FREE'], otherDiet: null, allergies: ['TREE_NUTS'], otherAllergy: null }),
    [{ kind: 'allergy', name: 'Tree nuts' }, { kind: 'diet', name: 'Lactose-free' }],
  );
});

test('the saved requirements are grouped by exactly the same needs, with how many guests', () => {
  const saved = (changes) => ({
    diets: [], otherDiet: null, allergies: [], otherAllergy: null, otherRequests: null, hasAllergies: false, ...changes,
  });
  const groups = groupRequirements([
    saved({ diets: ['VEGAN'], allergies: ['PEANUTS'], hasAllergies: true }),
    saved({ diets: ['VEGETARIAN'] }),
    saved({ allergies: ['SHELLFISH'], otherRequests: 'No mushrooms, please', hasAllergies: true }),
    saved({ diets: ['VEGETARIAN'] }),
    saved({ allergies: ['SHELLFISH'], hasAllergies: true }),
  ]);
  assert.deepEqual(groups, [
    { count: 1, chips: [{ kind: 'allergy', name: 'Peanuts' }, { kind: 'diet', name: 'Vegan' }], request: null },
    { count: 2, chips: [{ kind: 'diet', name: 'Vegetarian' }], request: null },
    { count: 1, chips: [{ kind: 'allergy', name: 'Shellfish' }], request: 'No mushrooms, please' },
    { count: 1, chips: [{ kind: 'allergy', name: 'Shellfish' }], request: null },
  ]);
});

test('the same needs chosen in another order are one group', () => {
  const a = { diets: ['VEGAN', 'LACTOSE_FREE'], otherDiet: null, allergies: ['MILK', 'EGGS'], otherAllergy: null, otherRequests: null };
  const b = { ...a, diets: ['LACTOSE_FREE', 'VEGAN'], allergies: ['EGGS', 'MILK'] };
  assert.equal(groupRequirements([a, b]).length, 1);
  assert.equal(groupRequirements([a, b])[0].count, 2);
});
