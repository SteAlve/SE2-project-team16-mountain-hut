import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { close, run } from '../../src/dao/db.js';
import * as bookings from '../../src/dao/bookings.js';
import * as slots from '../../src/dao/slots.js';
import * as tableSets from '../../src/dao/tableSets.js';
import {
  cleanBookingData,
  createHiker,
  createSlot,
  createSlotWithoutTableSet,
} from '../helpers/bookingFixtures.js';

const clean = async () => {
  await cleanBookingData();
  await run("DELETE FROM app_user WHERE email LIKE 'copy-week-hiker-%@example.com'");
};

const newSet = () => tableSets.insert({
  name: `test-copy-week-${randomUUID()}`,
  tables: [{ tableNumber: 1, capacity: 4 }],
});

const newSlot = ({ date, startsAt = '12:00', endsAt = '13:00', tableSetId = null }) =>
  slots.insert({ serviceDate: date, startsAt, endsAt, tableSetId });

beforeEach(clean);
afterAll(async () => {
  await clean();
  await close();
});

describe('slots dao, copying schedule intervals', () => {
  it('repeats the source schedule in a sequential interval and a separate interval', async () => {
    const tableSetId = await newSet();
    await newSlot({ date: '2090-11-04', tableSetId });
    await newSlot({ date: '2090-11-10', startsAt: '19:00', endsAt: '20:00' });

    const result = await slots.copyScheduleIntervals({
      sourceStart: '2090-11-04',
      destinationIntervals: [
        { from: '2090-11-18', to: '2090-12-01' },
        { from: '2090-12-16', to: '2090-12-22' },
      ],
    });

    expect(result).toEqual({ copiedSlots: 6, replacedSlots: 0 });
    const copied = await slots.findBetween('2090-11-18', '2090-12-22');
    expect(copied.map(({ serviceDate, startsAt, tableSetId: copiedSet }) => [serviceDate, startsAt, copiedSet])).toEqual([
      ['2090-11-18', '12:00:00', tableSetId],
      ['2090-11-24', '19:00:00', null],
      ['2090-11-25', '12:00:00', tableSetId],
      ['2090-12-01', '19:00:00', null],
      ['2090-12-16', '12:00:00', tableSetId],
      ['2090-12-22', '19:00:00', null],
    ]);
  });

  it('replaces unreserved destination slots', async () => {
    const tableSetId = await newSet();
    await newSlot({ date: '2090-01-02', tableSetId });
    await newSlot({ date: '2090-01-16', startsAt: '09:00', endsAt: '10:00' });
    await newSlot({ date: '2090-01-17', startsAt: '19:00', endsAt: '20:00' });

    const result = await slots.copyScheduleIntervals({
      sourceStart: '2090-01-02',
      destinationIntervals: [{ from: '2090-01-16', to: '2090-01-22' }],
    });

    expect(result).toEqual({ copiedSlots: 1, replacedSlots: 2 });
    await expect(slots.findBetween('2090-01-16', '2090-01-22')).resolves.toMatchObject([
      { serviceDate: '2090-01-16', startsAt: '12:00:00', tableSetId },
    ]);
  });

  it('rejects every destination and changes nothing when one destination has a booking', async () => {
    const source = await createSlot({ date: '2090-03-04' });
    const booked = await createSlot({ date: '2090-03-18' });
    await createSlotWithoutTableSet('2090-04-01', '19:00', '20:00');
    const hiker = await createHiker(`copy-week-hiker-${randomUUID()}@example.com`);
    await bookings.createWithTableAssignments({
      hikerId: hiker.id,
      slotId: booked.slotId,
      partySize: 1,
      tableAssignments: [{ tableId: booked.tableIds[0], seatCount: 1 }],
    });

    await expect(slots.copyScheduleIntervals({
      sourceStart: '2090-03-04',
      destinationIntervals: [
        { from: '2090-03-18', to: '2090-03-24' },
        { from: '2090-04-01', to: '2090-04-07' },
      ],
    })).rejects.toMatchObject({ code: 'WEEK_HAS_BOOKINGS' });

    await expect(slots.findBetween('2090-03-18', '2090-04-07')).resolves.toMatchObject([
      { slotId: booked.slotId, serviceDate: '2090-03-18' },
      { serviceDate: '2090-04-01', startsAt: '19:00:00' },
    ]);
    await expect(slots.findById(source.slotId)).resolves.not.toBeNull();
  });

  it('rejects an incomplete or misaligned destination interval before changing data', async () => {
    await expect(slots.copyScheduleIntervals({
      sourceStart: '2090-05-01',
      destinationIntervals: [{ from: '2090-05-15', to: '2090-05-20' }],
    })).rejects.toMatchObject({ code: 'INVALID_DESTINATION_INTERVAL' });

    await expect(slots.copyScheduleIntervals({
      sourceStart: '2090-06-01',
      destinationIntervals: [{ from: '2090-06-07', to: '2090-06-12' }],
    })).rejects.toMatchObject({ code: 'INVALID_DESTINATION_INTERVAL' });
  });
});
