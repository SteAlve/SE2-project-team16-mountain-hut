/**
 * LIB: the hikers an employee reserves for (MH-07, mockup docs/mockups/reservation-for-a-hiker,
 * "Fields and rules"): how they are written, the search text and the checks of "New hiker", run in
 * the browser before sending. The server checks them again.
 * A hiker is { id, firstName, lastName, email, phone, temporary } (email null for a temporary one).
 */

// The server answers 400 to a shorter text, so the page does not send it.
export const MIN_SEARCH_LENGTH = 2;
// The server sends at most this many hikers: a longer text narrows the list.
export const MAX_SEARCH_RESULTS = 20;

// The two ways to enter a hiker who is not found.
export const HIKER_MODES = Object.freeze({ QUICK: 'quick', FULL: 'full' });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d ]*\d[\d ]*$/;

const isBlank = (value) => value.trim() === '';

// 'Giulia Rossi'
export const hikerName = ({ firstName, lastName }) => `${firstName} ${lastName}`;

// 'GR'
export const hikerInitials = ({ firstName, lastName }) => `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();

// The text to send to the search, or null while it is too short.
export const searchText = (query) => {
  const text = query.trim();
  return text.length >= MIN_SEARCH_LENGTH ? text : null;
};

// What the helper under "Find the hiker" says about the results ([] or null while searching).
export function searchSummary(hikers) {
  if (hikers === null) return 'Name, phone or email. Searching…';
  if (hikers.length === 0) return 'Name, phone or email. No hiker found.';
  const found = `Name, phone or email. ${hikers.length} ${hikers.length === 1 ? 'hiker' : 'hikers'} found.`;
  return hikers.length >= MAX_SEARCH_RESULTS ? `${found} Type more to narrow the list.` : found;
}

// { field: message } for the fields of "New hiker" that fail, in the order of the form.
// The email is only for a full profile.
export function validateNewHiker({ mode, firstName, lastName, email, phone }) {
  const errors = {};
  if (isBlank(firstName)) errors.firstName = 'Enter the first name.';
  if (isBlank(lastName)) errors.lastName = 'Enter the last name.';
  if (mode === HIKER_MODES.FULL && !EMAIL.test(email.trim())) {
    errors.email = 'Enter a valid email, like name@example.com.';
  }
  if (!isBlank(phone) && !PHONE.test(phone.trim())) errors.phone = 'Enter a valid phone number.';
  return errors;
}

// The body of POST /api/staff/hikers: trimmed, without the email for a quick entry.
export const newHikerBody = ({ mode, firstName, lastName, email, phone }) => ({
  firstName: firstName.trim(),
  lastName: lastName.trim(),
  email: mode === HIKER_MODES.FULL ? email.trim() : null,
  phone: phone.trim() || null,
});

// The hiker of `hikers` (a search by email) who has exactly this email, or null.
export const ownerOfEmail = (hikers, email) =>
  hikers.find((hiker) => hiker.email?.toLowerCase() === email.trim().toLowerCase()) ?? null;
