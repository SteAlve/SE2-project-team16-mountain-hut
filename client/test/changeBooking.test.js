import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bookingNow,
  bookingReference,
  buildChanges,
  changeFailure,
  changeLine,
  isNeedsOnly,
  startsAfterNotice,
  stripStart,
} from '../src/lib/changeBooking.js';

const booking = {
  id: 1,
  slotId: 13,
  date: '2026-07-17',
  startsAt: '13:00',
  endsAt: '14:00',
  partySize: 4,
  tables: [{ tableNumber: 3, seats: 4 }],
  requirements: [
    { diets: ['VEGAN'], otherDiet: null, allergies: ['PEANUTS'], otherAllergy: null, otherRequests: null, hasAllergies: true },
    { diets: [], otherDiet: null, allergies: [], otherAllergy: null, otherRequests: 'High chair', hasAllergies: false },
  ],
};
const same = { slotId: 13, partySize: 4, requirements: [
  { diets: ['VEGAN'], allergies: ['PEANUTS'] },
  { diets: [], allergies: [], otherRequests: 'High chair' },
] };

test('the reference is QUOTA- and the id on five digits', () => {
  assert.equal(bookingReference(1), 'QUOTA-00001');
  assert.equal(bookingReference(12345), 'QUOTA-12345');
});

test('a meal exactly 48 hours away can be chosen, one minute less cannot', () => {
  const now = new Date(2026, 6, 15, 13, 0);
  assert.equal(startsAfterNotice('2026-07-17', '13:00', now), true);
  assert.equal(startsAfterNotice('2026-07-17', '12:59', now), false);
  assert.equal(startsAfterNotice('2026-07-18', '12:00', now), true);
});

test('the strip starts at the first day 48 hours away, or at the booking when that is earlier', () => {
  const now = new Date(2026, 6, 10, 9, 0);
  assert.equal(stripStart('2026-07-17', now), '2026-07-12');
  assert.equal(stripStart('2026-07-11', now), '2026-07-11');
});

test('a booking far ahead starts the strip a week before it', () => {
  const now = new Date(2026, 6, 10, 9, 0);
  assert.equal(stripStart('2026-12-20', now), '2026-12-13');
});

test('the line under Edit says until when, or when the changes closed', () => {
  assert.deepEqual(changeLine({ canChange: true, changeableUntil: '2026-07-15T13:00' }), {
    closed: false,
    text: 'Change until Wed 15 Jul · 13:00',
  });
  assert.deepEqual(changeLine({ canChange: false, changeableUntil: '2026-07-13T12:00' }), {
    closed: true,
    text: 'Changes closed on Mon 13 Jul · 12:00',
  });
  assert.equal(changeLine({ canChange: true }), null);
});

test('the booking as it is now', () => {
  assert.equal(bookingNow(booking), 'Fri 17 Jul · 13:00 – 14:00 · 4 people');
  assert.equal(bookingNow({ ...booking, partySize: 1 }), 'Fri 17 Jul · 13:00 – 14:00 · 1 person');
});

test('nothing changed sends nothing', () => {
  assert.deepEqual(buildChanges(booking, same), {});
});

test('only what differs is sent', () => {
  assert.deepEqual(buildChanges(booking, { ...same, slotId: 14 }), { slotId: 14 });
  assert.deepEqual(buildChanges(booking, { ...same, partySize: 6 }), { partySize: 6 });
});

test('the same needs in another order of the guests are not a change', () => {
  assert.deepEqual(buildChanges(booking, { ...same, requirements: [...same.requirements].reverse() }), {});
});

test('a change of the needs alone is sent without the slot or the party, so the seats are not checked', () => {
  const changes = buildChanges(booking, { ...same, requirements: [{ allergies: ['SHELLFISH'] }] });
  assert.deepEqual(Object.keys(changes), ['requirements']);
  assert.equal(isNeedsOnly(changes), true);
  assert.equal(isNeedsOnly({ ...changes, partySize: 2 }), false);
});

test('removing every need is a change: an empty list', () => {
  assert.deepEqual(buildChanges(booking, { ...same, requirements: [] }), { requirements: [] });
});

test('the notes of the refused changes', () => {
  const slot = { startsAt: '12:00', endsAt: '13:00' };
  const ctx = { slot, partySize: 6 };
  assert.equal(
    changeFailure({ status: 409, code: 'NO_SEATS', message: 'Not enough free seats' }, ctx),
    'There are not enough free seats at 12:00 – 13:00 for 6 people. Your booking stays as it is.',
  );
  assert.equal(
    changeFailure({ status: 409, code: 'BOOKING_CHANGED', message: 'x' }, ctx),
    'This booking was changed in the meantime. Reload it and try again.',
  );
  assert.equal(
    changeFailure({ status: 422, message: 'Bookings can be changed until 48 hours before the meal' }, ctx),
    'Bookings can be changed until 48 hours before the meal. Your booking stays as it is.',
  );
  assert.equal(
    changeFailure({ status: 422, message: 'You already have a booking for this slot' }, ctx),
    'You already have a booking for this slot. Choose another day or time.',
  );
  assert.equal(changeFailure({ status: 404, message: 'x' }, ctx), 'Something went wrong on our side. Try again in a minute.');
  assert.equal(changeFailure({ status: 0, message: 'x' }, ctx), 'Something went wrong on our side. Try again in a minute.');
});
