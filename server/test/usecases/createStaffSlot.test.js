import { describe, expect, it } from 'vitest';
import { ConflictError } from '../../src/domain/errors.js';
import { makeCreateStaffSlot } from '../../src/usecases/createStaffSlot.js';

// The use case with simulated dependencies: the database says "refused" (insert answers null) and
// the use case works out why.
const input = { user: { id: 1, role: 'EMPLOYEE' }, date: '2090-01-01', startsAt: '12:30', endsAt: '13:30' };

const refusedBecauseOf = (other) => makeCreateStaffSlot({
  slots: { insert: async () => null, findOverlapping: async () => other },
  tableSets: {},
});

describe('createStaffSlot, a slot that overlaps another one', () => {
  it('says which slot is in the way', async () => {
    const create = refusedBecauseOf({ slotId: 7, startsAt: '12:00:00', endsAt: '13:00:00' });

    const error = await create(input).catch((caught) => caught);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error.message).toBe('The slot overlaps the slot from 12:00 to 13:00 on 2090-01-01');
  });

  it('keeps the message of a slot that starts at the same time', async () => {
    const create = refusedBecauseOf({ slotId: 7, startsAt: '12:30:00', endsAt: '14:00:00' });

    await expect(create(input)).rejects.toThrow('A slot starting at 12:30 already exists on 2090-01-01');
  });

  it('still answers 409 when the slot in the way is not found any more', async () => {
    const create = refusedBecauseOf(null);

    const error = await create(input).catch((caught) => caught);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error.message).toBe('The slot overlaps another slot on 2090-01-01');
  });
});
