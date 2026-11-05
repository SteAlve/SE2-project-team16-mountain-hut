import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatBookUntil } from '../src/lib/bookingDates.js';

test('a server deadline on today uses the short label without recalculating its time', () => {
  const now = new Date(2026, 10, 5, 9);
  assert.equal(formatBookUntil('2026-11-05', '19:00', now, '2026-11-05T17:00'), '17:00 today');
});

test('a server deadline on another day retains its explicit date', () => {
  const now = new Date(2026, 10, 5, 9);
  assert.equal(formatBookUntil('2026-11-06', '19:00', now, '2026-11-06T17:00'), '17:00 on Fri 6 Nov');
});

test('a deadline crossing midnight displays the closure date rather than the slot date', () => {
  const now = new Date(2026, 10, 5, 9);
  assert.equal(formatBookUntil('2026-11-06', '01:00', now, '2026-11-05T23:00'), '23:00 today');
});

test('a server deadline through a DST change is used verbatim', () => {
  const now = new Date(2026, 9, 24, 12);
  assert.equal(formatBookUntil('2026-10-25', '03:30', now, '2026-10-25T02:30'), '02:30 on Sun 25 Oct');
});

test('legacy DTOs without a server deadline retain the two-hour fallback', () => {
  const now = new Date(2026, 10, 5, 9);
  assert.equal(formatBookUntil('2026-11-05', '19:00', now), '17:00 today');
});
