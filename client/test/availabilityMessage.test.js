import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unavailableMessage } from '../src/lib/availabilityMessage.js';

test('an explicit no-matching-slot search explanation is preserved', () => {
  assert.equal(unavailableMessage({ message: 'No meal slots overlap your selected time range.' }, 2), 'No meal slots overlap your selected time range.');
});

test('404 explains that the time no longer exists even if its old capacity was sufficient', () => {
  assert.equal(unavailableMessage({ error: { status: 404 }, freeSeats: 10 }, 2), 'This meal time is no longer available.');
});

test('422 with failed slot refresh never claims that 10 seats are insufficient for 2', () => {
  const text = unavailableMessage({ error: { status: 422 }, latest: null, freeSeats: 10, label: '10 seats free' }, 2);
  assert.equal(text, 'This meal time cannot be booked. Choose another time.');
  assert.doesNotMatch(text, /not enough|10/);
});

test('422 uses the refreshed closure time instead of explaining an unrelated shortage', () => {
  assert.equal(unavailableMessage({ error: { status: 422 }, latest: { bookingOpen: false, bookingClosesAt: '2026-11-06T10:00', freeSeats: 0 } }, 2), 'Closed at 10:00');
});

test('422 with no closure timestamp has a safe explanation', () => {
  assert.equal(unavailableMessage({ error: { status: 422 }, latest: { bookingOpen: false } }, 2), 'Booking for this meal time is closed.');
});

test('422 can use a known closure label when refreshing slots fails', () => {
  assert.equal(unavailableMessage({ error: { status: 422 }, label: 'Closed at 10:00', latest: null }, 2), 'Closed at 10:00');
});

test('422 with a refreshed zero-capacity slot says it has no free seats', () => {
  assert.equal(unavailableMessage({ error: { status: 422 }, latest: { bookingOpen: true, freeSeats: 0 }, freeSeats: 10 }, 2), 'This time has no free seats.');
});

test('422 with seats available does not invent a capacity failure', () => {
  assert.equal(unavailableMessage({ error: { status: 422 }, latest: { bookingOpen: true, freeSeats: 10 } }, 2), 'This meal time cannot be booked. Choose another time.');
});

test('409 uses refreshed capacity rather than stale free seats', () => {
  assert.equal(unavailableMessage({ error: { status: 409 }, latest: { freeSeats: 3 }, freeSeats: 10 }, 6), 'This time has 3 free seats, not enough for 6 people.');
});

test('409 with zero seats gives the full-slot message', () => {
  assert.equal(unavailableMessage({ error: { status: 409 }, freeSeats: 0 }, 2), 'This time has no free seats.');
});

for (const freeSeats of [10, 2, undefined]) {
  test(`409 with stale or unknown capacity ${freeSeats} does not invent a numeric shortage`, () => {
    const text = unavailableMessage({ error: { status: 409 }, latest: null, freeSeats }, 2);
    assert.equal(text, 'There are not enough free seats for your party. Availability may have changed.');
  });
}

test('unknown unavailable state has a safe default', () => {
  assert.equal(unavailableMessage({}, 2), 'This meal time is currently unavailable.');
});
