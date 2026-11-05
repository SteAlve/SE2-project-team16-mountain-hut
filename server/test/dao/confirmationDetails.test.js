// findConfirmationDetails (MH-29) against the test database: what the confirmation email is
// written from.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { close, get, run } from '../../src/dao/db.js';
import * as bookings from '../../src/dao/bookings.js';
import { cleanBookingData, createSlot } from '../helpers/bookingFixtures.js';

let hiker;

const clean = async () => {
  await cleanBookingData();
  await run("DELETE FROM app_user WHERE email LIKE '%@example.com'");
};

beforeEach(async () => {
  await clean();
  hiker = await get(
    `INSERT INTO app_user (first_name, last_name, email, role, password_hash)
     VALUES ('Mara', 'Rossi', 'details.hiker@example.com', 'HIKER', 'x') RETURNING id`,
  );
});
afterAll(async () => {
  await clean();
  await close();
});

const book = (slot, partySize, tableAssignments) =>
  bookings.createWithTableAssignments({ hikerId: hiker.id, slotId: slot.slotId, partySize, tableAssignments });

describe('findConfirmationDetails', () => {
  it('gives the hiker, the slot as text and the party size, and no tables', async () => {
    const slot = await createSlot({ date: '2090-07-01', startsAt: '12:30', endsAt: '14:00', seats: [4] });
    const booking = await book(slot, 3, [{ tableId: slot.tableIds[0], seatCount: 3 }]);

    expect(await bookings.findConfirmationDetails(booking.id)).toEqual({
      bookingId: booking.id,
      firstName: 'Mara',
      lastName: 'Rossi',
      email: 'details.hiker@example.com',
      date: '2090-07-01',
      startsAt: '12:30:00',
      endsAt: '14:00:00',
      partySize: 3,
    });
  });

  it('gives one answer for a party split over tables', async () => {
    const slot = await createSlot({ seats: [2, 2, 2] });
    const booking = await book(slot, 6, slot.tableIds.map((tableId) => ({ tableId, seatCount: 2 })));

    expect(await bookings.findConfirmationDetails(booking.id)).toMatchObject({ bookingId: booking.id, partySize: 6 });
  });

  it('gives the booking asked for, not another one of the same hiker', async () => {
    const lunch = await createSlot({ date: '2090-07-02', startsAt: '12:00', endsAt: '13:00' });
    const dinner = await createSlot({ date: '2090-07-02', startsAt: '19:00', endsAt: '20:00' });
    await book(lunch, 1, [{ tableId: lunch.tableIds[0], seatCount: 1 }]);
    const second = await book(dinner, 2, [{ tableId: dinner.tableIds[0], seatCount: 2 }]);

    expect(await bookings.findConfirmationDetails(second.id)).toMatchObject({ startsAt: '19:00:00', partySize: 2 });
  });

  it('gives null for a booking that does not exist', async () => {
    expect(await bookings.findConfirmationDetails(999999999)).toBeNull();
  });
});
