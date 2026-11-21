import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bookingNow,
  bookingReference,
  buildChanges,
  canSaveChange,
  changeFailure,
  changeLine,
  isNeedsOnly,
  hutDay,
  hutInstant,
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
  // 13:00 in Rome (summer time, UTC+2) is 11:00 UTC.
  const now = new Date(Date.UTC(2026, 6, 15, 11, 0));
  assert.equal(startsAfterNotice('2026-07-17', '13:00', now), true);
  assert.equal(startsAfterNotice('2026-07-17', '12:59', now), false);
  assert.equal(startsAfterNotice('2026-07-18', '12:00', now), true);
});

test('the 48 hours are counted at the hut, not in the time zone of the browser', () => {
  // 23:30 UTC on 14 Jul is already 01:30 of 15 Jul in Rome.
  assert.equal(hutDay(new Date(Date.UTC(2026, 6, 14, 23, 30))), '2026-07-15');
  assert.equal(hutDay(new Date(Date.UTC(2026, 0, 14, 23, 30))), '2026-01-15');
  assert.equal(hutInstant('2026-07-17', '13:00').toISOString(), '2026-07-17T11:00:00.000Z');
  assert.equal(hutInstant('2026-01-17', '13:00').toISOString(), '2026-01-17T12:00:00.000Z');
  // The clocks go back on 25 Oct 2026 (03:00 → 02:00): 13:00 that day is UTC+1.
  assert.equal(hutInstant('2026-10-25', '13:00').toISOString(), '2026-10-25T12:00:00.000Z');
});

test('the strip starts at the first day 48 hours away, or at the booking when that is earlier', () => {
  const now = new Date(Date.UTC(2026, 6, 10, 7, 0));
  assert.equal(stripStart('2026-07-17', now), '2026-07-12');
  assert.equal(stripStart('2026-07-11', now), '2026-07-11');
});

test('a booking far ahead starts the strip a week before it', () => {
  const now = new Date(Date.UTC(2026, 6, 10, 7, 0));
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
    'This booking was changed in the meantime, so nothing was saved. Its new details are below: open it again to change it.',
  );
  assert.equal(
    changeFailure({ status: 422, message: 'Bookings can be changed until 48 hours before the meal' }, ctx),
    'Bookings can be changed until 48 hours before the meal. Your booking stays as it is.',
  );
  assert.equal(
    changeFailure({ status: 422, message: 'You already have a booking for this slot' }, ctx),
    'You already have a booking for this slot. Choose another day or time.',
  );
  assert.equal(changeFailure({ status: 404, message: 'x' }, ctx), 'This booking is no longer in your list, so nothing was saved.');
  assert.equal(changeFailure({ status: 0, message: 'x' }, ctx), 'Something went wrong on our side. Try again in a minute.');
});

test('save is disabled on another day until a time is chosen, but dietary-only changes stay saveable', () => {
  const needsChange = { requirements: [] };
  const slot = { slotId: 20 };
  // Dietary change, day and time untouched (also when the times did not load): saveable.
  assert.equal(canSaveChange({ changes: needsChange, slot: null, timeTouched: false, isPending: false }), true);
  // Dietary change, then another day whose time is full: no time chosen, not saveable.
  assert.equal(canSaveChange({ changes: needsChange, slot: null, timeTouched: true, isPending: false }), false);
  // A time chosen on the new day: saveable.
  assert.equal(canSaveChange({ changes: { ...needsChange, slotId: 20 }, slot, timeTouched: true, isPending: false }), true);
  // Nothing changed, or saving in progress: not saveable.
  assert.equal(canSaveChange({ changes: {}, slot, timeTouched: false, isPending: false }), false);
  assert.equal(canSaveChange({ changes: needsChange, slot: null, timeTouched: false, isPending: true }), false);
});
