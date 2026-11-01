import { all, get, inTransaction, run } from './db.js';

const isPositiveInteger = (value) => Number.isSafeInteger(value) && value > 0;

// A failure the use case can tell apart (it cannot import this file): the `code` of the error.
//   SEATS_UNAVAILABLE   a table has fewer free seats than asked, e.g. a booking came in just before
//   DUPLICATE_BOOKING   the hiker already has an active booking for the slot
const fail = (code, message) => Object.assign(new RangeError(message), { code });

const validateBooking = ({ hikerId, slotId, partySize, tableAssignments }) => {
  if (!isPositiveInteger(hikerId)) {
    throw new TypeError('hikerId must be a positive safe integer.');
  }

  if (!isPositiveInteger(slotId)) {
    throw new TypeError('slotId must be a positive safe integer.');
  }

  if (!isPositiveInteger(partySize)) {
    throw new TypeError('partySize must be a positive safe integer.');
  }

  if (!Array.isArray(tableAssignments) || tableAssignments.length === 0) {
    throw new TypeError('tableAssignments must contain at least one table.');
  }

  const tableIds = new Set();
  let assignedSeats = 0;

  for (const assignment of tableAssignments) {
    if (
      !assignment
      || !isPositiveInteger(assignment.tableId)
      || !isPositiveInteger(assignment.seatCount)
    ) {
      throw new TypeError('Each table assignment needs a positive tableId and seatCount.');
    }

    if (tableIds.has(assignment.tableId)) {
      throw new TypeError('A table can appear only once in tableAssignments.');
    }

    tableIds.add(assignment.tableId);
    assignedSeats += assignment.seatCount;
  }

  if (assignedSeats !== partySize) {
    throw new RangeError('Assigned seats must equal partySize.');
  }
};

// Does the hiker already have an active (not cancelled) booking for the slot?
export const hasActiveBooking = async (hikerId, slotId) => {
  const row = await get(
    'SELECT 1 AS found FROM booking WHERE hiker_id = $1 AND slot_id = $2 AND cancelled_at IS NULL',
    [hikerId, slotId],
  );
  return row !== null;
};

export const createWithTableAssignments = async ({
  hikerId,
  slotId,
  partySize,
  tableAssignments,
}) => {
  validateBooking({ hikerId, slotId, partySize, tableAssignments });

  return inTransaction(async () => {
    const slot = await get(
      'SELECT id, table_set_id AS "tableSetId" FROM slot WHERE id = $1 FOR UPDATE',
      [slotId],
    );

    if (!slot) {
      throw new RangeError(`Slot ${slotId} does not exist.`);
    }

    if (slot.tableSetId === null) {
      throw new RangeError(`Slot ${slotId} has no table set and cannot be booked.`);
    }

    // The slot is locked, so two bookings for it take turns: this check cannot be overtaken.
    if (await hasActiveBooking(hikerId, slotId)) {
      throw fail('DUPLICATE_BOOKING', `Hiker ${hikerId} already has a booking for slot ${slotId}.`);
    }

    const tableIds = tableAssignments.map(({ tableId }) => tableId);
    const availableTables = await all(
      `
        WITH booked_seats AS (
          SELECT
            booking_table.hut_table_id,
            SUM(booking_table.seat_count)::INTEGER AS seat_count
          FROM booking_table
          JOIN booking ON booking.id = booking_table.booking_id
          WHERE booking_table.slot_id = $1
            AND booking.cancelled_at IS NULL
          GROUP BY booking_table.hut_table_id
        )
        SELECT
          hut_table.id AS "tableId",
          hut_table.seat_capacity - COALESCE(booked_seats.seat_count, 0)
            AS "freeSeats"
        FROM hut_table
        LEFT JOIN booked_seats ON booked_seats.hut_table_id = hut_table.id
        WHERE hut_table.table_set_id = $2
          AND hut_table.id = ANY($3::INTEGER[])
      `,
      [slotId, slot.tableSetId, tableIds],
    );

    if (availableTables.length !== tableAssignments.length) {
      throw fail('SEATS_UNAVAILABLE', `One or more tables are not available for slot ${slotId}.`);
    }

    const freeSeatsByTable = new Map(
      availableTables.map(({ tableId, freeSeats }) => [tableId, freeSeats]),
    );

    for (const { tableId, seatCount } of tableAssignments) {
      const freeSeats = freeSeatsByTable.get(tableId);

      if (seatCount > freeSeats) {
        throw fail(
          'SEATS_UNAVAILABLE',
          `Table ${tableId} has ${freeSeats} free seats in slot ${slotId}; ${seatCount} requested.`,
        );
      }
    }

    const booking = await get(
      `
        INSERT INTO booking (slot_id, table_set_id, hiker_id, party_size)
        VALUES ($1, $2, $3, $4)
        RETURNING id, slot_id AS "slotId", party_size AS "partySize"
      `,
      [slotId, slot.tableSetId, hikerId, partySize],
    );

    for (const { tableId, seatCount } of tableAssignments) {
      await run(
        `
          INSERT INTO booking_table
            (booking_id, slot_id, table_set_id, hut_table_id, seat_count)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [booking.id, slotId, slot.tableSetId, tableId, seatCount],
      );
    }

    return { ...booking, tableAssignments };
  });
};
