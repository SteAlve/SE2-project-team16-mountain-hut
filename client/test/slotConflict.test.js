import assert from 'node:assert/strict';
import { test } from 'node:test';
import { slotConflict } from '../src/lib/slotConflict.js';

const form = { date: '2026-10-28', startsAt: '12:30', endsAt: '13:30' };

test('an overlap names the slot in the way and marks the start and the end (#85)', () => {
  const error = {
    status: 409,
    code: 'SLOT_OVERLAP',
    message: 'The slot overlaps the slot from 12:00 to 13:00 on 2026-10-28',
    details: { slot: { startsAt: '12:00', endsAt: '13:00' } },
  };
  assert.deepEqual(slotConflict(error, form), {
    alert: 'This slot overlaps the slot from 12:00 to 13:00 on Wed 28 Oct. The day was reloaded: choose times that do not overlap.',
    errors: { startsAt: 'Overlaps another slot.', endsAt: 'Overlaps another slot.' },
  });
});

test('an overlap without the slot in the way still says so', () => {
  const error = { status: 409, code: 'SLOT_OVERLAP', message: 'The slot overlaps another slot on 2026-10-28' };
  assert.equal(
    slotConflict(error, form).alert,
    'This slot overlaps another slot on Wed 28 Oct. The day was reloaded: choose times that do not overlap.',
  );
});

test('a slot with the same start keeps its message and marks only the start', () => {
  const error = { status: 409, message: 'A slot starting at 12:30 already exists on 2026-10-28' };
  assert.deepEqual(slotConflict(error, form), {
    alert: 'A slot starting at 12:30 already exists on Wed 28 Oct. The day was reloaded: choose another start time.',
    errors: { startsAt: 'Already used.' },
  });
});
