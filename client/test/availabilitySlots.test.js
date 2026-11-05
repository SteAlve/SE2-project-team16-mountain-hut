import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findSearchSlots } from '../src/lib/availabilitySlots.js';
import { slotAvailability } from '../src/lib/slotAvailability.js';

const slots = [
  { slotId: 1, startsAt: '12:00:00', endsAt: '13:00:00', bookable: true },
  { slotId: 2, startsAt: '13:00:00', endsAt: '14:00:00', bookable: true },
  { slotId: 3, startsAt: '19:00:00', endsAt: '21:00:00', bookable: true },
];
const ids = (items) => items.map((item) => item.slotId);

for (const [from, to, expected] of [
  ['12:00', '13:00', [1]],
  ['13:00', '14:00', [2]],
  ['12:30', '13:30', [1, 2]],
  ['12:15', '12:45', [1]],
  ['19:00', '20:00', [3]],
  ['19:00', '23:59', [3]],
  ['14:00', '19:00', []],
  ['12:00', '21:00', [1, 2, 3]],
]) {
  test(`overlap and automatic selection for ${from}-${to}`, () => {
    const found = findSearchSlots(slots, from, to);
    assert.deepEqual(ids(found.overlapping), expected);
    assert.deepEqual(ids(found.candidates), expected);
    assert.equal(found.automatic?.slotId ?? null, expected.length === 1 ? expected[0] : null);
  });
}

test('selects only the open overlap with enough seats, retaining unavailable overlaps', () => {
  const day = '2026-11-06';
  const now = new Date('2026-11-06T07:00:00Z');
  const data = [
    { slotId: 1, startsAt: '12:00', endsAt: '13:00', freeSeats: 2, bookingOpen: true },
    { slotId: 2, startsAt: '13:00', endsAt: '14:00', freeSeats: 6, bookingOpen: true },
    { slotId: 3, startsAt: '13:30', endsAt: '14:30', freeSeats: 20, bookingOpen: false, bookingClosesAt: `${day}T11:30` },
  ];
  const decorated = data.map((slot) => ({ ...slot, ...slotAvailability(slot, day, 6, now) }));
  const found = findSearchSlots(decorated, '12:00', '15:00');
  assert.deepEqual(ids(found.overlapping), [1, 2, 3]);
  assert.deepEqual(ids(found.candidates), [2]);
  assert.equal(found.automatic.slotId, 2);
  assert.equal(data[0].bookable, undefined); // Search must not modify API data.
});

test('a sole unavailable overlap is selected to obtain the server explanation', () => {
  const found = findSearchSlots([{ ...slots[0], bookable: false }], '12:00', '13:00');
  assert.deepEqual(found.candidates, []);
  assert.equal(found.automatic.slotId, 1);
});

test('multiple unavailable overlaps require a choice and never select a full time arbitrarily', () => {
  const found = findSearchSlots(slots.map((slot) => ({ ...slot, bookable: false })), '12:00', '14:00');
  assert.deepEqual(ids(found.overlapping), [1, 2]);
  assert.deepEqual(found.candidates, []);
  assert.equal(found.automatic, null);
});

test('an empty day has no candidate or automatic selection', () => {
  assert.deepEqual(findSearchSlots([], '12:00', '14:00'), { overlapping: [], candidates: [], automatic: null });
});

test('a nonoverlapping available slot is never suggested as an automatic alternative', () => {
  const found = findSearchSlots([{ ...slots[0], bookable: false }, slots[2]], '12:00', '13:00');
  assert.equal(found.automatic.slotId, 1);
  assert.deepEqual(found.candidates, []);
});
