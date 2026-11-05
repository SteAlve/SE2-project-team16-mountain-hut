import assert from 'node:assert/strict';
import { test } from 'node:test';
import { availabilityResult } from '../src/lib/availabilityResult.js';

const key = '1:2:0';
const result = {
  key, revision: '10:true', status: 'available', tables: [{ tableNumber: 1, seats: 2 }],
};

test('a first check shows loading until the server has answered', () => {
  assert.deepEqual(availabilityResult(null, key, '10:true', {}), { status: 'loading' });
});

test('a capacity refresh preserves the seating answer instead of showing the skeleton', () => {
  const answer = availabilityResult(result, key, '8:true', { freeSeats: 8 });
  assert.equal(answer.status, 'available');
  assert.equal(answer.isRefreshing, true);
  assert.deepEqual(answer.tables, [{ tableNumber: 1, seats: 2 }]);
  assert.equal(answer.freeSeats, 8);
});

test('a fresh response ends background refreshing', () => {
  const updated = { ...result, revision: '8:true', tables: [{ tableNumber: 3, seats: 2 }] };
  const answer = availabilityResult(updated, key, '8:true', {});
  assert.equal(answer.isRefreshing, false);
  assert.deepEqual(answer.tables, [{ tableNumber: 3, seats: 2 }]);
});

test('a closure keeps the old answer marked refreshing until revalidated', () => {
  assert.equal(availabilityResult(result, key, '10:false', {}).isRefreshing, true);
});

for (const changedKey of ['2:2:0', '1:6:0', '1:2:1']) {
  test(`a changed time, party or explicit retry ${changedKey} cannot display the old answer`, () => {
    assert.deepEqual(availabilityResult(result, changedKey, '10:true', {}), { status: 'loading' });
  });
}

test('a new conflict response replaces an old available result after refresh', () => {
  const conflict = { key, revision: '0:false', status: 'unavailable', error: { status: 409 } };
  const answer = availabilityResult(conflict, key, '0:false', { freeSeats: 0 });
  assert.equal(answer.status, 'unavailable');
  assert.equal(answer.isRefreshing, false);
});
