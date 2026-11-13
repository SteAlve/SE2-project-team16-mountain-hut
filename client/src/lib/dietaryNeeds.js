/**
 * LIB: the dietary needs and allergies of a booking (story MH-05, mockup docs/mockups/dietary).
 *
 * The hiker fills in LINES: one per group of guests with exactly the same needs, with how many
 * guests they are. A line is
 *   { key, guests, diets, otherDiet, allergies, otherAllergy, otherRequests }
 * where `diets` and `allergies` hold the codes of the chosen cards, OTHER included, and the
 * texts are what the hiker typed (kept even when Other is unselected, so it comes back).
 *
 * The server knows only REQUIREMENTS, one per guest (docs/openapi.json, RequirementRequest):
 * toRequirements() turns a line of N guests into N equal requirements. The server checks
 * everything again; these checks only say what is wrong before anything is sent.
 */

// The card that opens a text field, for a diet or an allergy that is not in the list.
export const OTHER = 'OTHER';

// The preset lists, in the order of the cards (the same codes as the server).
export const DIETS = [
  { code: 'VEGETARIAN', name: 'Vegetarian' },
  { code: 'VEGAN', name: 'Vegan' },
  { code: 'PESCATARIAN', name: 'Pescatarian' },
  { code: 'LACTOSE_FREE', name: 'Lactose-free' },
  { code: OTHER, name: 'Other' },
];

export const ALLERGIES = [
  { code: 'GLUTEN', name: 'Gluten' },
  { code: 'MILK', name: 'Milk' },
  { code: 'EGGS', name: 'Eggs' },
  { code: 'PEANUTS', name: 'Peanuts' },
  { code: 'TREE_NUTS', name: 'Tree nuts' },
  { code: 'FISH', name: 'Fish' },
  { code: 'SHELLFISH', name: 'Shellfish' },
  { code: OTHER, name: 'Other' },
];

// These diets exclude each other: choosing one unselects the others.
const EXCLUSIVE_DIETS = ['VEGETARIAN', 'VEGAN', 'PESCATARIAN'];

export const MAX_OTHER_LENGTH = 100;
export const MAX_REQUESTS_LENGTH = 300;

// '1 guest', '3 guests'
export const guests = (n) => `${n} ${n === 1 ? 'guest' : 'guests'}`;

export const emptyLine = (key) => ({
  key,
  guests: 1,
  diets: [],
  otherDiet: '',
  allergies: [],
  otherAllergy: '',
  otherRequests: '',
});

// The guests counted in all the lines.
export const countGuests = (lines) => lines.reduce((sum, line) => sum + line.guests, 0);

const toggle = (codes, code) => (codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code]);

export function toggleDiet(line, code) {
  if (line.diets.includes(code) || !EXCLUSIVE_DIETS.includes(code)) {
    return { ...line, diets: toggle(line.diets, code) };
  }
  return { ...line, diets: [...line.diets.filter((c) => !EXCLUSIVE_DIETS.includes(c)), code] };
}

export const toggleAllergy = (line, code) => ({ ...line, allergies: toggle(line.allergies, code) });

const tooLong = (max) => `Too long: at most ${max} characters.`;

// What is wrong with a line, as the messages of the mockup: { otherDiet, otherAllergy,
// otherRequests, line }, only the keys with a problem. {} when the line can be sent.
export function lineErrors(line) {
  const errors = {};
  const otherDiet = line.otherDiet.trim();
  const otherAllergy = line.otherAllergy.trim();
  const otherRequests = line.otherRequests.trim();

  if (line.diets.includes(OTHER)) {
    if (!otherDiet) errors.otherDiet = 'Write which diet, or unselect Other.';
    else if (otherDiet.length > MAX_OTHER_LENGTH) errors.otherDiet = tooLong(MAX_OTHER_LENGTH);
  }
  if (line.allergies.includes(OTHER)) {
    if (!otherAllergy) errors.otherAllergy = 'Write which allergy, or unselect Other.';
    else if (otherAllergy.length > MAX_OTHER_LENGTH) errors.otherAllergy = tooLong(MAX_OTHER_LENGTH);
  }
  if (otherRequests.length > MAX_REQUESTS_LENGTH) errors.otherRequests = tooLong(MAX_REQUESTS_LENGTH);
  if (line.diets.length === 0 && line.allergies.length === 0 && !otherRequests) {
    errors.line = 'Choose a diet or an allergy, or write a request, or remove this line.';
  }
  return errors;
}

export const isValidLine = (line) => Object.keys(lineErrors(line)).length === 0;

// One requirement of the API, for one guest of the line. The texts are sent only when they say
// something: an Other card adds its text, an empty request is left out.
export function toRequirement(line) {
  const requirement = {
    diets: line.diets.filter((code) => code !== OTHER),
    allergies: line.allergies.filter((code) => code !== OTHER),
  };
  if (line.diets.includes(OTHER)) requirement.otherDiet = line.otherDiet.trim();
  if (line.allergies.includes(OTHER)) requirement.otherAllergy = line.otherAllergy.trim();
  const otherRequests = line.otherRequests.trim();
  if (otherRequests) requirement.otherRequests = otherRequests;
  return requirement;
}

// The body of POST /api/bookings: each line becomes as many requirements as its guests, in the
// order the lines were added.
export const toRequirements = (lines) =>
  lines.flatMap((line) => Array.from({ length: line.guests }, () => toRequirement(line)));

const nameOf = (list, code) => list.find((option) => option.code === code)?.name ?? code;

// The chips of a requirement, the allergies first (red), then the diets (green), each group in
// the order they were chosen. An Other card shows its text, or "Other" while it is empty.
// [{ kind: 'allergy' | 'diet', name }]
export function needChips({ diets = [], otherDiet = null, allergies = [], otherAllergy = null }) {
  const named = (list, kind) => (code) => ({ kind, name: nameOf(list, code) });
  const other = (text, kind) => (typeof text === 'string' ? [{ kind, name: text || 'Other' }] : []);
  return [
    ...allergies.map(named(ALLERGIES, 'allergy')),
    ...other(otherAllergy, 'allergy'),
    ...diets.map(named(DIETS, 'diet')),
    ...other(otherDiet, 'diet'),
  ];
}

export const lineChips = (line) => needChips(toRequirement(line));

const sameNeedsKey = ({ diets = [], otherDiet = null, allergies = [], otherAllergy = null, otherRequests = null }) =>
  JSON.stringify([[...diets].sort(), otherDiet ?? null, [...allergies].sort(), otherAllergy ?? null, otherRequests ?? null]);

// The saved requirements as the confirmation shows them: guests with exactly the same needs
// share one group, in the order of their first guest. [{ count, chips, request }]
export function groupRequirements(requirements) {
  const groups = new Map();
  for (const requirement of requirements) {
    const key = sameNeedsKey(requirement);
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { count: 1, chips: needChips(requirement), request: requirement.otherRequests ?? null });
  }
  return [...groups.values()];
}
