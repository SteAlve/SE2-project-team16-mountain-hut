import { describe, expect, it, vi } from 'vitest';
import { makeCreateStaffBooking } from '../../src/usecases/createStaffBooking.js';
import { ForbiddenError, NotFoundError } from '../../src/domain/errors.js';

const employee = { id: 1, role: 'EMPLOYEE' };
const hiker = { id: 2, role: 'HIKER' };
const bookingInput = {
  hikerId: 8,
  slotId: 12,
  partySize: 2,
  tables: [{ tableNumber: 7, seats: 2 }],
  requirements: [{ diets: ['VEGAN'], allergies: ['PEANUTS'], otherDiet: null, otherAllergy: null, otherRequests: null }],
};

function setup(foundHiker = { id: 8, temporary: false }) {
  const slots = {
    findById: vi.fn().mockResolvedValue({
      slotId: 12, serviceDate: '2090-11-04', startsAt: '12:00:00', tableSetId: 3,
    }),
    findAvailableTablesBySlotId: vi.fn().mockResolvedValue([{ tableId: 3, tableNumber: 7, freeSeats: 4 }]),
  };
  const bookings = {
    hasActiveBooking: vi.fn().mockResolvedValue(false),
    createWithTableAssignments: vi.fn().mockResolvedValue({ id: 45, requirements: bookingInput.requirements }),
  };
  const users = { findHikerById: vi.fn().mockResolvedValue(foundHiker) };
  const checkSlotOpen = vi.fn();
  return {
    users, slots, bookings, checkSlotOpen,
    book: makeCreateStaffBooking({ users, slots, bookings, checkSlotOpen }),
  };
}

describe('createStaffBooking use case', () => {
  it('books for the selected hiker and passes dietary requirements to the common booking flow', async () => {
    const t = setup();

    await expect(t.book({ user: employee, ...bookingInput })).resolves.toEqual({
      id: 45, date: '2090-11-04', slotId: 12, partySize: 2,
      tables: [{ tableNumber: 7, seats: 2 }], requirements: bookingInput.requirements,
    });
    expect(t.users.findHikerById).toHaveBeenCalledExactlyOnceWith(8);
    expect(t.checkSlotOpen).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ slotId: 12 }));
    expect(t.bookings.createWithTableAssignments).toHaveBeenCalledExactlyOnceWith({
      hikerId: 8, slotId: 12, partySize: 2,
      tableAssignments: [{ tableId: 3, seatCount: 2 }], requirements: bookingInput.requirements,
    });
  });

  it('accepts a temporary hiker as the booking target', async () => {
    const t = setup({ id: 8, temporary: true });

    await expect(t.book({ user: employee, ...bookingInput })).resolves.toMatchObject({ id: 45 });
  });

  it('refuses a hiker before looking up the target', async () => {
    const t = setup();

    await expect(t.book({ user: hiker, ...bookingInput }))
      .rejects.toThrow(new ForbiddenError('Only the staff can do this'));
    expect(t.users.findHikerById).not.toHaveBeenCalled();
  });

  it('answers 404 when the target is not a hiker', async () => {
    const t = setup(null);

    await expect(t.book({ user: employee, ...bookingInput }))
      .rejects.toThrow(new NotFoundError('Hiker 8 not found'));
    expect(t.slots.findById).not.toHaveBeenCalled();
  });
});
