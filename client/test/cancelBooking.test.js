import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cancelFailure, cancelNotice, cancelSummary } from '../src/lib/cancelBooking.js';

test('the dialog says which table will be cancelled', () => {
  assert.equal(
    cancelSummary({ partySize: 4, date: '2026-07-17', startsAt: '13:00', endsAt: '14:00' }),
    'Your table for 4 on Fri 17 Jul, 13:00 – 14:00 will be cancelled.',
  );
});

test('the note of a cancelled booking uses its reference', () => {
  assert.equal(cancelNotice(1), 'Booking QUOTA-00001 cancelled. We emailed you a confirmation.');
});

test('a booking already cancelled shows the server message as a sentence', () => {
  assert.equal(cancelFailure({ status: 422, message: 'This booking was already cancelled' }), 'This booking was already cancelled.');
  assert.equal(cancelFailure({ status: 422, message: 'Already done.' }), 'Already done.');
});

test('a booking not found, the network and the server give the generic note; a 403 its own message', () => {
  const generic = 'Something went wrong on our side. Try again in a minute.';
  assert.equal(cancelFailure({ status: 404, message: 'Booking 45 not found' }), generic);
  assert.equal(cancelFailure({ status: 0, message: 'Unable to reach the server' }), generic);
  assert.equal(cancelFailure({ status: 500, message: 'Unexpected error' }), generic);
  assert.equal(cancelFailure({ status: 403, message: 'Only hikers can cancel bookings' }), 'Only hikers can cancel bookings');
});
