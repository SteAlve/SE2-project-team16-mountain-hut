import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { close, get } from '../../src/dao/db.js';
import * as slots from '../../src/dao/slots.js';
import * as tableSets from '../../src/dao/tableSets.js';
import { cleanBookingData } from '../helpers/bookingFixtures.js';

// The slots of the staff: creating them, listing a period and giving them a table set. The dates are
// in 2090, and cleanBookingData() removes what these tests create (slots without a table set, and
// sets named "test-").
const newSet = () => tableSets.insert({ name: `test-${randomUUID()}`, tables: [{ tableNumber: 1, capacity: 4 }] });

const newSlot = (serviceDate, startsAt, endsAt, tableSetId = null) =>
  slots.insert({ serviceDate, startsAt, endsAt, tableSetId });

beforeEach(cleanBookingData);
afterAll(async () => {
  await cleanBookingData();
  await close();
});

describe('slots dao, creating a slot', () => {
  it('creates a slot with a table set and one without, and reads them back', async () => {
    const tableSetId = await newSet();

    const withSet = await newSlot('2090-05-01', '12:00', '13:00', tableSetId);
    const withoutSet = await newSlot('2090-05-01', '19:00', '21:00');

    expect(await slots.findById(withSet.slotId)).toEqual({
      slotId: withSet.slotId,
      serviceDate: '2090-05-01',
      startsAt: '12:00:00',
      endsAt: '13:00:00',
      tableSetId,
    });
    expect(await slots.findById(withoutSet.slotId)).toMatchObject({ startsAt: '19:00:00', tableSetId: null });
  });

  it('answers null for a second slot that starts at the same time on the same day', async () => {
    await newSlot('2090-05-02', '12:00', '13:00');

    expect(await newSlot('2090-05-02', '12:00', '14:00')).toBeNull();
  });

  it('keeps only one slot when two slots with the same start are created at the same time', async () => {
    const results = await Promise.all([newSlot('2090-05-15', '12:00', '13:00'), newSlot('2090-05-15', '12:00', '14:00')]);

    expect(results.filter((slot) => slot === null)).toHaveLength(1);
    expect((await get('SELECT COUNT(*)::INT AS n FROM slot WHERE service_date = $1', ['2090-05-15'])).n).toBe(1);
  });

  it('allows slots that follow each other, and the same start time on another day', async () => {
    expect(await newSlot('2090-05-03', '12:00', '13:00')).not.toBeNull();
    expect(await newSlot('2090-05-03', '13:00', '14:00')).not.toBeNull();
    expect(await newSlot('2090-05-04', '12:00', '13:00')).not.toBeNull();
  });

  it('refuses an end that is not after the start', async () => {
    await expect(newSlot('2090-05-05', '12:00', '12:00')).rejects.toMatchObject({ code: '23514' });
    await expect(newSlot('2090-05-05', '13:00', '12:00')).rejects.toMatchObject({ code: '23514' });
  });

  it('refuses a table set that does not exist', async () => {
    await expect(newSlot('2090-05-06', '12:00', '13:00', 999999999)).rejects.toMatchObject({ code: '23503' });
  });
});

describe('slots dao, listing a period', () => {
  it('lists the slots from a day to another, both days included, in order, with and without table set', async () => {
    const tableSetId = await newSet();
    await newSlot('2090-06-01', '12:00', '13:00', tableSetId);
    const lateOn2 = await newSlot('2090-06-02', '19:00', '21:00', tableSetId);
    const earlyOn2 = await newSlot('2090-06-02', '12:00', '13:00');
    const on3 = await newSlot('2090-06-03', '12:00', '13:00');
    await newSlot('2090-06-04', '12:00', '13:00', tableSetId);

    const listed = await slots.findBetween('2090-06-02', '2090-06-03');

    expect(listed).toEqual([
      { slotId: earlyOn2.slotId, serviceDate: '2090-06-02', startsAt: '12:00:00', endsAt: '13:00:00', tableSetId: null },
      { slotId: lateOn2.slotId, serviceDate: '2090-06-02', startsAt: '19:00:00', endsAt: '21:00:00', tableSetId },
      { slotId: on3.slotId, serviceDate: '2090-06-03', startsAt: '12:00:00', endsAt: '13:00:00', tableSetId: null },
    ]);
  });

  it('lists one day when the two days are the same, and nothing for a period without slots', async () => {
    const slot = await newSlot('2090-06-10', '12:00', '13:00');

    expect((await slots.findBetween('2090-06-10', '2090-06-10')).map((row) => row.slotId)).toEqual([slot.slotId]);
    expect(await slots.findBetween('2090-06-20', '2090-06-25')).toEqual([]);
  });
});

describe('slots dao, giving a table set to a slot', () => {
  it('gives the set to a slot that has none', async () => {
    const tableSetId = await newSet();
    const slot = await newSlot('2090-07-01', '12:00', '13:00');

    expect(await slots.assignTableSet(slot.slotId, tableSetId)).toBe(true);

    expect((await slots.findById(slot.slotId)).tableSetId).toBe(tableSetId);
  });

  it('does not change a slot that has a set already, not even to give it the same one', async () => {
    const first = await newSet();
    const other = await newSet();
    const slot = await newSlot('2090-07-02', '12:00', '13:00', first);

    expect(await slots.assignTableSet(slot.slotId, other)).toBe(false);
    expect(await slots.assignTableSet(slot.slotId, first)).toBe(false);

    expect((await slots.findById(slot.slotId)).tableSetId).toBe(first);
  });

  it('answers false for a slot that does not exist', async () => {
    expect(await slots.assignTableSet(999999999, await newSet())).toBe(false);
  });

  it('lets one set be given to many slots', async () => {
    const tableSetId = await newSet();
    const one = await newSlot('2090-07-03', '12:00', '13:00');
    const two = await newSlot('2090-07-03', '13:00', '14:00');

    expect(await slots.assignTableSet(one.slotId, tableSetId)).toBe(true);
    expect(await slots.assignTableSet(two.slotId, tableSetId)).toBe(true);
  });

  it('lets only one of two requests win when they give different sets to the same slot', async () => {
    const a = await newSet();
    const b = await newSet();
    const slot = await newSlot('2090-07-04', '12:00', '13:00');

    const [wonA, wonB] = await Promise.all([slots.assignTableSet(slot.slotId, a), slots.assignTableSet(slot.slotId, b)]);

    expect([wonA, wonB].filter(Boolean)).toHaveLength(1);
    expect((await slots.findById(slot.slotId)).tableSetId).toBe(wonA ? a : b);
  });

  it('refuses a table set that does not exist', async () => {
    const slot = await newSlot('2090-07-05', '12:00', '13:00');

    await expect(slots.assignTableSet(slot.slotId, 999999999)).rejects.toMatchObject({ code: '23503' });
  });

  // The API ids are int64 but the column is an INTEGER: a larger id is a slot that does not exist.
  it('finds nothing for a slot id above the largest integer of the database', async () => {
    expect(await slots.findById(3000000000)).toBeNull();
  });
});
