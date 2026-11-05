import assert from 'node:assert/strict';
import { test } from 'node:test';
import { slotAvailability } from '../src/lib/slotAvailability.js';

const day = '2026-11-06';
const now = new Date('2026-11-06T08:00:00Z');
const slot = { startsAt: '12:00', endsAt: '13:00', freeSeats: 6, bookingOpen: true, bookingClosesAt: `${day}T10:00` };

test('exact capacity fits, including seats distributed across several tables', () => {
  assert.deepEqual(slotAvailability(slot, day, 6, now), { bookable: true, label: '6 seats free' });
});

test('a party above capacity is unavailable without being silently reduced', () => {
  const partySize = 1000000;
  assert.deepEqual(slotAvailability(slot, day, partySize, now), { bookable: false, label: 'Only 6 seats free' });
});

test('a zero-capacity or full slot is not a candidate', () => {
  assert.deepEqual(slotAvailability({ ...slot, freeSeats: 0 }, day, 1, now), { bookable: false, label: 'Full' });
});

test('server closure overrides free capacity and a browser clock before the deadline', () => {
  assert.deepEqual(slotAvailability({ ...slot, bookingOpen: false }, day, 2, new Date('2026-11-05T01:00:00Z')), { bookable: false, label: 'Closed at 10:00' });
});

test('server bookingOpen wins even if the browser clock would mark the slot closed', () => {
  assert.equal(slotAvailability(slot, day, 2, new Date('2026-11-07T01:00:00Z')).bookable, true);
});
