import { describe, expect, it, vi } from 'vitest';
import { clock as realClock } from '../../src/clock.js';
import { makeChangeBooking } from '../../src/usecases/changeBooking.js';

const user = { id: 7, role: 'HIKER' };
const booking = {
  id: 45,
  hikerId: user.id,
  slotId: 12,
  date: '2090-11-04',
  startsAt: '12:00:00',
  partySize: 2,
  requirements: [{ diets: [], allergies: [] }],
  cancelled: false,
};
const updated = { ...booking, requirements: [{ diets: ['VEGAN'], allergies: [] }] };
const slot = { slotId: 13, serviceDate: '2090-11-06', startsAt: '12:00:00' };
const assignments = [{ tableId: 20, seatCount: 4 }];

function setup({ currentBooking = booking, freeTables = [{ tableId: 20, freeSeats: 8 }], now } = {}) {
  const bookings = {
    findById: vi.fn().mockResolvedValue(currentBooking),
    hasActiveBooking: vi.fn().mockResolvedValue(false),
    updateBooking: vi.fn().mockResolvedValue({
      ...currentBooking,
      requirements: updated.requirements,
    }),
  };
  const slots = {
    findById: vi.fn().mockResolvedValue(slot),
    findAvailableTablesBySlotId: vi.fn().mockResolvedValue(freeTables),
  };
  const checkSlotOpen = vi.fn();
  const clock = {
    now: vi.fn(() => now ?? new Date('2090-11-01T10:00:00Z')),
    at: vi.fn(realClock.at),
  };
  const changeBooking = makeChangeBooking({
    bookings,
    slots,
    checkSlotOpen,
    clock,
    hutTimeZone: 'Europe/Rome',
  });

  return { bookings, slots, clock, checkSlotOpen, changeBooking };
}

describe('changeBooking', () => {
  it('updates dietary requirements without reassigning the booking tables', async () => {
    const t = setup();
    const requirements = [{ diets: ['VEGAN'], allergies: [] }];

    await expect(t.changeBooking({ user, bookingId: booking.id, requirements })).resolves.toEqual(updated);

    expect(t.bookings.findById).toHaveBeenCalledExactlyOnceWith(booking.id);
    expect(t.slots.findById).not.toHaveBeenCalled();
    expect(t.slots.findAvailableTablesBySlotId).not.toHaveBeenCalled();
    expect(t.bookings.updateBooking).toHaveBeenCalledExactlyOnceWith({
      bookingId: booking.id,
      expected: { slotId: booking.slotId, partySize: booking.partySize },
      seats: null,
      requirements,
    });
  });

  it('reassigns tables when the party grows and keeps the original slot', async () => {
    const t = setup({ freeTables: [{ tableId: 20, freeSeats: 4 }] });

    await t.changeBooking({ user, bookingId: booking.id, partySize: 4 });

    expect(t.slots.findById).not.toHaveBeenCalled();
    expect(t.slots.findAvailableTablesBySlotId).toHaveBeenCalledExactlyOnceWith(
      booking.slotId, { exceptBookingId: booking.id },
    );
    expect(t.bookings.updateBooking).toHaveBeenCalledExactlyOnceWith({
      bookingId: booking.id,
      expected: { slotId: booking.slotId, partySize: booking.partySize },
      seats: { slotId: booking.slotId, partySize: 4, tableAssignments: assignments },
      requirements: null,
    });
  });

  it('recalculates the seats when the party shrinks, releasing the unused seats', async () => {
    const t = setup({ freeTables: [{ tableId: 20, freeSeats: 8 }] });

    await t.changeBooking({ user, bookingId: booking.id, partySize: 1 });

    expect(t.bookings.updateBooking).toHaveBeenCalledWith(expect.objectContaining({
      seats: { slotId: booking.slotId, partySize: 1, tableAssignments: [{ tableId: 20, seatCount: 1 }] },
    }));
  });

  it('moves to an open destination and checks its availability, preserving omitted fields', async () => {
    const t = setup({ freeTables: [{ tableId: 21, freeSeats: 2 }] });

    await t.changeBooking({ user, bookingId: booking.id, slotId: slot.slotId });

    expect(t.slots.findById).toHaveBeenCalledExactlyOnceWith(slot.slotId);
    expect(t.checkSlotOpen).toHaveBeenCalledExactlyOnceWith(slot);
    expect(t.bookings.hasActiveBooking).toHaveBeenCalledExactlyOnceWith(user.id, slot.slotId);
    expect(t.slots.findAvailableTablesBySlotId).toHaveBeenCalledExactlyOnceWith(
      slot.slotId, { exceptBookingId: booking.id },
    );
    expect(t.bookings.updateBooking).toHaveBeenCalledExactlyOnceWith({
      bookingId: booking.id,
      expected: { slotId: booking.slotId, partySize: booking.partySize },
      seats: { slotId: slot.slotId, partySize: booking.partySize, tableAssignments: [{ tableId: 21, seatCount: 2 }] },
      requirements: null,
    });
  });

  it('rejects a move when the hiker already has a booking in the destination slot', async () => {
    const t = setup();
    t.bookings.hasActiveBooking.mockResolvedValue(true);

    await expect(t.changeBooking({ user, bookingId: booking.id, slotId: slot.slotId }))
      .rejects.toMatchObject({ name: 'UnprocessableError', message: 'You already have a booking for this slot' });

    expect(t.slots.findAvailableTablesBySlotId).not.toHaveBeenCalled();
    expect(t.bookings.updateBooking).not.toHaveBeenCalled();
  });

  it('rejects a move when the destination slot cannot be booked', async () => {
    const t = setup();
    const failure = new Error('Slot closed');
    t.checkSlotOpen.mockImplementation(() => { throw failure; });

    await expect(t.changeBooking({ user, bookingId: booking.id, slotId: slot.slotId })).rejects.toBe(failure);
    expect(t.bookings.updateBooking).not.toHaveBeenCalled();
  });

  it('rejects a missing destination slot', async () => {
    const t = setup();
    t.slots.findById.mockResolvedValue(null);

    await expect(t.changeBooking({ user, bookingId: booking.id, slotId: slot.slotId }))
      .rejects.toMatchObject({ name: 'NotFoundError', message: `Slot ${slot.slotId} not found` });
    expect(t.bookings.updateBooking).not.toHaveBeenCalled();
  });

  it('rejects a change when the original slot has passed its 48-hour deadline', async () => {
    const t = setup({ now: new Date('2090-11-02T11:00:00.001Z') });

    await expect(t.changeBooking({ user, bookingId: booking.id, partySize: 3 }))
      .rejects.toMatchObject({ name: 'UnprocessableError', message: 'Bookings can be changed until 48 hours before the meal' });
    expect(t.bookings.updateBooking).not.toHaveBeenCalled();
  });

  it('allows a change at the exact 48-hour boundary', async () => {
    const t = setup({ now: new Date('2090-11-02T11:00:00.000Z') });

    await t.changeBooking({ user, bookingId: booking.id, partySize: 3 });

    expect(t.bookings.updateBooking).toHaveBeenCalledOnce();
  });

  it('allows a move when the destination is exactly at its 48-hour boundary', async () => {
    const t = setup({
      now: new Date('2090-11-04T11:00:00.000Z'),
      currentBooking: { ...booking, date: '2090-11-08' },
    });

    await t.changeBooking({ user, bookingId: booking.id, slotId: slot.slotId });

    expect(t.bookings.updateBooking).toHaveBeenCalledOnce();
  });

  it('rejects a move if the destination is inside its 48-hour change window', async () => {
    const t = setup({
      now: new Date('2090-11-04T11:00:00.001Z'),
      currentBooking: { ...booking, date: '2090-11-08' },
    });

    await expect(t.changeBooking({ user, bookingId: booking.id, slotId: slot.slotId }))
      .rejects.toMatchObject({ name: 'UnprocessableError', message: 'Bookings can be changed until 48 hours before the meal' });
    expect(t.bookings.updateBooking).not.toHaveBeenCalled();
  });

  it('rejects an increase when the available seats are insufficient and leaves the booking untouched', async () => {
    const t = setup({ freeTables: [{ tableId: 20, freeSeats: 1 }] });

    await expect(t.changeBooking({ user, bookingId: booking.id, partySize: 4 }))
      .rejects.toMatchObject({ name: 'ConflictError', code: 'NO_SEATS' });
    expect(t.bookings.updateBooking).not.toHaveBeenCalled();
  });

  it('does not let an employee change a booking', async () => {
    const t = setup();

    await expect(t.changeBooking({ user: { id: 8, role: 'EMPLOYEE' }, bookingId: booking.id, partySize: 3 }))
      .rejects.toMatchObject({ name: 'ForbiddenError' });
    expect(t.bookings.findById).not.toHaveBeenCalled();
  });

  it('does not reveal a booking owned by another hiker', async () => {
    const t = setup({ currentBooking: { ...booking, hikerId: 8 } });

    await expect(t.changeBooking({ user, bookingId: booking.id, partySize: 3 }))
      .rejects.toMatchObject({ name: 'NotFoundError' });
    expect(t.bookings.updateBooking).not.toHaveBeenCalled();
  });

  it('rejects a cancelled booking', async () => {
    const t = setup({ currentBooking: { ...booking, cancelled: true } });

    await expect(t.changeBooking({ user, bookingId: booking.id, partySize: 3 }))
      .rejects.toMatchObject({ name: 'UnprocessableError', message: 'This booking was cancelled' });
    expect(t.bookings.updateBooking).not.toHaveBeenCalled();
  });

  it('rejects more dietary requirement lines than people', async () => {
    const t = setup();
    const requirements = [
      { diets: ['VEGAN'], allergies: [] },
      { diets: [], allergies: ['GLUTEN'] },
      { diets: [], allergies: ['MILK'] },
    ];

    await expect(t.changeBooking({ user, bookingId: booking.id, requirements }))
      .rejects.toMatchObject({ name: 'UnprocessableError' });
    expect(t.bookings.updateBooking).not.toHaveBeenCalled();
  });

  it.each([
    [{ diets: ['UNKNOWN'], allergies: [] }],
    [{ diets: ['VEGAN', 'VEGETARIAN'], allergies: [] }],
    [{ diets: [], allergies: ['UNKNOWN'] }],
  ])('rejects invalid or incompatible dietary choices before loading the booking', async (requirement) => {
    const t = setup();

    await expect(t.changeBooking({
      user, bookingId: booking.id, requirements: [requirement],
    })).rejects.toMatchObject({ name: 'ValidationError' });

    expect(t.bookings.findById).not.toHaveBeenCalled();
    expect(t.bookings.updateBooking).not.toHaveBeenCalled();
  });

  it.each([
    ['SEATS_UNAVAILABLE', 'ConflictError', 'NO_SEATS'],
    ['DUPLICATE_BOOKING', 'UnprocessableError', undefined],
    ['BOOKING_NOT_FOUND', 'UnprocessableError', undefined],
    ['BOOKING_CHANGED', 'ConflictError', 'BOOKING_CHANGED'],
    ['TOO_MANY_REQUIREMENTS', 'ConflictError', 'BOOKING_CHANGED'],
  ])('translates a concurrent DAO error (%s) into the use-case error', async (code, name, translatedCode) => {
    const t = setup();
    t.bookings.updateBooking.mockRejectedValue(Object.assign(new Error('DAO conflict'), { code }));

    await expect(t.changeBooking({ user, bookingId: booking.id, partySize: 3 }))
      .rejects.toMatchObject({ name, ...(translatedCode ? { code: translatedCode } : {}) });
  });
});
