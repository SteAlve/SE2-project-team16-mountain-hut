import { all, get, inTransaction, run } from './db.js';

const isPositiveInteger = (value) => Number.isSafeInteger(value) && value > 0;

const validateBooking = ({ slotId, partySize, tableAssignments }) => {
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

export const createWithTableAssignments = async ({
  slotId,
  partySize,
  tableAssignments,
}) => {
  validateBooking({ slotId, partySize, tableAssignments });

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

    const tableIds = tableAssignments.map(({ tableId }) => tableId);
    const availableTables = await all(
      `
        WITH booked_seats AS (
          SELECT
            booking_table.table_set_table_id,
            SUM(booking_table.seat_count)::INTEGER AS seat_count
          FROM booking_table
          JOIN booking ON booking.id = booking_table.booking_id
          WHERE booking_table.slot_id = $1
            AND booking.cancelled_at IS NULL
          GROUP BY booking_table.table_set_table_id
        )
        SELECT
          table_set_table.id AS "tableId",
          table_set_table.seat_capacity - COALESCE(booked_seats.seat_count, 0)
            AS "freeSeats"
        FROM table_set_table
        LEFT JOIN booked_seats ON booked_seats.table_set_table_id = table_set_table.id
        WHERE table_set_table.table_set_id = $2
          AND table_set_table.id = ANY($3::INTEGER[])
      `,
      [slotId, slot.tableSetId, tableIds],
    );

    if (availableTables.length !== tableAssignments.length) {
      throw new RangeError(`One or more tables are not available for slot ${slotId}.`);
    }

    const freeSeatsByTable = new Map(
      availableTables.map(({ tableId, freeSeats }) => [tableId, freeSeats]),
    );

    for (const { tableId, seatCount } of tableAssignments) {
      const freeSeats = freeSeatsByTable.get(tableId);

      if (seatCount > freeSeats) {
        throw new RangeError(
          `Table ${tableId} has ${freeSeats} free seats in slot ${slotId}; ${seatCount} requested.`,
        );
      }
    }

    const booking = await get(
      `
        INSERT INTO booking (slot_id, table_set_id, party_size)
        VALUES ($1, $2, $3)
        RETURNING id, slot_id AS "slotId", party_size AS "partySize"
      `,
      [slotId, slot.tableSetId, partySize],
    );

    for (const { tableId, seatCount } of tableAssignments) {
      await run(
        `
          INSERT INTO booking_table
            (booking_id, slot_id, table_set_id, table_set_table_id, seat_count)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [booking.id, slotId, slot.tableSetId, tableId, seatCount],
      );
    }

    return { ...booking, tableAssignments };
  });
};
