import { all, get, inTransaction, run } from './db.js';

const isPositiveInteger = (value) => Number.isSafeInteger(value) && value > 0;

// A failure the use case can tell apart (it cannot import this file): the `code` of the error.
//   SEATS_UNAVAILABLE   a table has fewer free seats than asked, e.g. a booking came in just before
//   DUPLICATE_BOOKING   the hiker already has an active booking for the slot
//   BOOKING_NOT_FOUND   the booking to change does not exist or was cancelled (MH-06)
const fail = (code, message) => Object.assign(new RangeError(message), { code });

// A guest line of the dietary needs (MH-05): diets and allergies (arrays), otherDiet, otherAllergy and
// otherRequests (text or null), and at least one of them. The DTO and the domain have already
// checked the values.
const isTextOrNull = (value) => value === null || typeof value === 'string';

const validateRequirements = (requirements) => {
  if (!Array.isArray(requirements)) {
    throw new TypeError('requirements must be an array.');
  }

  for (const requirement of requirements) {
    if (
      !requirement
      || !Array.isArray(requirement.diets)
      || !Array.isArray(requirement.allergies)
      || !isTextOrNull(requirement.otherDiet)
      || !isTextOrNull(requirement.otherAllergy)
      || !isTextOrNull(requirement.otherRequests)
    ) {
      throw new TypeError('Each requirement needs diets, allergies, otherDiet, otherAllergy and otherRequests.');
    }

    const { diets, allergies, otherDiet, otherAllergy, otherRequests } = requirement;
    if (!diets.length && !allergies.length && otherDiet === null && otherAllergy === null && otherRequests === null) {
      throw new TypeError('Each requirement needs at least one need or a request.');
    }
  }
};

const validateTableAssignments = (partySize, tableAssignments) => {
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

const validateBooking = ({ hikerId, slotId, partySize, tableAssignments, requirements }) => {
  if (!isPositiveInteger(hikerId)) {
    throw new TypeError('hikerId must be a positive safe integer.');
  }

  if (!isPositiveInteger(slotId)) {
    throw new TypeError('slotId must be a positive safe integer.');
  }

  validateTableAssignments(partySize, tableAssignments);
  validateRequirements(requirements);
};

// Does the hiker already have an active (not cancelled) booking for the slot?
export const hasActiveBooking = async (hikerId, slotId) => {
  const row = await get(
    'SELECT 1 AS found FROM booking WHERE hiker_id = $1 AND slot_id = $2 AND cancelled_at IS NULL',
    [hikerId, slotId],
  );
  return row !== null;
};

// What the confirmation email needs (MH-03): the hiker and the slot of the booking. No table
// numbers: the product owner does not want them in the email (issue #24).
// Null when the booking does not exist.
export const findConfirmationDetails = (bookingId) => get(
  `
    SELECT
      booking.id AS "bookingId",
      app_user.first_name AS "firstName",
      app_user.last_name AS "lastName",
      app_user.email,
      slot.service_date::TEXT AS "date",
      slot.starts_at::TEXT AS "startsAt",
      slot.ends_at::TEXT AS "endsAt",
      booking.party_size AS "partySize"
    FROM booking
    JOIN app_user ON app_user.id = booking.hiker_id
    JOIN slot ON slot.id = booking.slot_id
    WHERE booking.id = $1
  `,
  [bookingId],
);

const REQUIREMENT_COLUMNS = `
  diets,
  other_diet AS "otherDiet",
  allergies,
  other_allergy AS "otherAllergy",
  other_requests AS "otherRequests",
  has_allergies AS "hasAllergies"
`;

// The dietary needs of a booking (MH-05), one line per guest, in the order the hiker added them.
export const findRequirements = (bookingId) => all(
  `
    SELECT ${REQUIREMENT_COLUMNS}
    FROM booking_requirement
    WHERE booking_id = $1
    ORDER BY id
  `,
  [bookingId],
);

// Locks the slot for the rest of the transaction, so two bookings of it take turns. Its table set,
// or a RangeError when the slot does not exist or has no tables.
const lockSlot = async (slotId) => {
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

  return slot;
};

// The seats asked must still be free, the slot being locked. The seats of exceptBookingId count as
// free (a booking being changed).
const checkSeatsFree = async (slotId, tableSetId, tableAssignments, exceptBookingId = null) => {
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
          AND ($4::INTEGER IS NULL OR booking.id <> $4)
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
    [slotId, tableSetId, tableIds, exceptBookingId],
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
};

const insertTables = async (bookingId, slotId, tableSetId, tableAssignments) => {
  for (const { tableId, seatCount } of tableAssignments) {
    await run(
      `
        INSERT INTO booking_table
          (booking_id, slot_id, table_set_id, hut_table_id, seat_count)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [bookingId, slotId, tableSetId, tableId, seatCount],
    );
  }
};

const insertRequirements = async (bookingId, requirements) => {
  const saved = [];
  for (const { diets, otherDiet, allergies, otherAllergy, otherRequests } of requirements) {
    saved.push(await get(
      `
        INSERT INTO booking_requirement
          (booking_id, diets, other_diet, allergies, other_allergy, other_requests)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING ${REQUIREMENT_COLUMNS}
      `,
      [bookingId, diets, otherDiet, allergies, otherAllergy, otherRequests],
    ));
  }
  return saved;
};

export const createWithTableAssignments = async ({
  hikerId,
  slotId,
  partySize,
  tableAssignments,
  requirements = [],
}) => {
  validateBooking({ hikerId, slotId, partySize, tableAssignments, requirements });

  return inTransaction(async () => {
    const slot = await lockSlot(slotId);

    // The slot is locked, so two bookings for it take turns: this check cannot be overtaken.
    if (await hasActiveBooking(hikerId, slotId)) {
      throw fail('DUPLICATE_BOOKING', `Hiker ${hikerId} already has a booking for slot ${slotId}.`);
    }

    await checkSeatsFree(slotId, slot.tableSetId, tableAssignments);

    const booking = await get(
      `
        INSERT INTO booking (slot_id, table_set_id, hiker_id, party_size)
        VALUES ($1, $2, $3, $4)
        RETURNING id, slot_id AS "slotId", party_size AS "partySize"
      `,
      [slotId, slot.tableSetId, hikerId, partySize],
    );

    await insertTables(booking.id, slotId, slot.tableSetId, tableAssignments);
    const savedRequirements = await insertRequirements(booking.id, requirements);

    return { ...booking, tableAssignments, requirements: savedRequirements };
  });
};

// A booking as the hiker sees it (MH-06): its slot, its tables by number and its dietary needs.
// The id is compared as a BIGINT, as in the slot dao: an id too big for INTEGER is a booking that
// does not exist, not an "out of range" error.
const BOOKING_SELECT = `
  SELECT
    booking.id,
    booking.hiker_id AS "hikerId",
    booking.slot_id AS "slotId",
    booking.party_size AS "partySize",
    booking.cancelled_at IS NOT NULL AS "cancelled",
    slot.service_date::TEXT AS "date",
    slot.starts_at::TEXT AS "startsAt",
    slot.ends_at::TEXT AS "endsAt",
    COALESCE((
      SELECT json_agg(json_build_object('tableNumber', hut_table.table_number, 'seats', booking_table.seat_count)
        ORDER BY hut_table.table_number)
      FROM booking_table
      JOIN hut_table ON hut_table.id = booking_table.hut_table_id
      WHERE booking_table.booking_id = booking.id
    ), '[]'::JSON) AS "tables",
    COALESCE((
      SELECT json_agg(json_build_object(
        'diets', booking_requirement.diets,
        'otherDiet', booking_requirement.other_diet,
        'allergies', booking_requirement.allergies,
        'otherAllergy', booking_requirement.other_allergy,
        'otherRequests', booking_requirement.other_requests,
        'hasAllergies', booking_requirement.has_allergies
      ) ORDER BY booking_requirement.id)
      FROM booking_requirement
      WHERE booking_requirement.booking_id = booking.id
    ), '[]'::JSON) AS "requirements"
  FROM booking
  JOIN slot ON slot.id = booking.slot_id
`;

// One booking, cancelled or not, or null.
export const findById = (bookingId) => get(
  `${BOOKING_SELECT} WHERE booking.id = $1::BIGINT`,
  [bookingId],
);

// The active bookings of a hiker from a day on ('YYYY-MM-DD', that day included), in order of day
// and time (MH-06: the page "My bookings").
export const findUpcomingByHiker = (hikerId, fromDate) => all(
  `
    ${BOOKING_SELECT}
    WHERE booking.hiker_id = $1
      AND booking.cancelled_at IS NULL
      AND slot.service_date >= $2::DATE
    ORDER BY slot.service_date, slot.starts_at, booking.id
  `,
  [hikerId, fromDate],
);

/**
 * Changes a booking (MH-06), in one transaction. What is not given stays as it is:
 *   seats         { slotId, partySize, tableAssignments }: the new slot, party and tables. The
 *                 old tables are freed first, so the booking can keep or reuse its own seats.
 *   requirements  the new dietary needs, which replace all the old lines.
 * Returns the booking as findById reads it.
 */
export const updateBooking = async ({ bookingId, expected, seats = null, requirements = null }) => {
  if (!isPositiveInteger(bookingId)) {
    throw new TypeError('bookingId must be a positive safe integer.');
  }
  if (seats !== null) {
    if (!isPositiveInteger(seats.slotId)) {
      throw new TypeError('slotId must be a positive safe integer.');
    }
    validateTableAssignments(seats.partySize, seats.tableAssignments);
  }
  if (requirements !== null) validateRequirements(requirements);

  return inTransaction(async () => {
    const booking = await get(
      `
        SELECT id, hiker_id AS "hikerId", slot_id AS "slotId", party_size AS "partySize"
        FROM booking
        WHERE id = $1 AND cancelled_at IS NULL
        FOR UPDATE
      `,
      [bookingId],
    );
    if (!booking) {
      throw fail('BOOKING_NOT_FOUND', `Booking ${bookingId} does not exist or was cancelled.`);
    }
    // The change was worked out from the booking as it was read before this lock: if another change
    // of the same booking was saved in between, this one would mix the two.
    if (booking.slotId !== expected.slotId || booking.partySize !== expected.partySize) {
      throw fail('BOOKING_CHANGED', `Booking ${bookingId} was changed by another request.`);
    }

    // At most one line of needs per person, checked again on what the booking will hold.
    const partySize = seats?.partySize ?? booking.partySize;
    const requirementCount = requirements?.length ?? (await get(
      'SELECT COUNT(*)::INTEGER AS count FROM booking_requirement WHERE booking_id = $1',
      [bookingId],
    )).count;
    if (requirementCount > partySize) {
      throw fail('TOO_MANY_REQUIREMENTS', `Booking ${bookingId} would have more needs than people.`);
    }

    if (seats !== null) {
      const { slotId, tableAssignments } = seats;
      const slot = await lockSlot(slotId);

      if (slotId !== booking.slotId) {
        const other = await get(
          `
            SELECT 1 AS found FROM booking
            WHERE hiker_id = $1 AND slot_id = $2 AND cancelled_at IS NULL AND id <> $3
          `,
          [booking.hikerId, slotId, bookingId],
        );
        if (other) {
          throw fail('DUPLICATE_BOOKING', `Hiker ${booking.hikerId} already has a booking for slot ${slotId}.`);
        }
      }

      await checkSeatsFree(slotId, slot.tableSetId, tableAssignments, bookingId);

      // booking_table points to the slot of the booking: its rows go before the slot changes.
      await run('DELETE FROM booking_table WHERE booking_id = $1', [bookingId]);
      await run(
        'UPDATE booking SET slot_id = $2, table_set_id = $3, party_size = $4 WHERE id = $1',
        [bookingId, slotId, slot.tableSetId, partySize],
      );
      await insertTables(bookingId, slotId, slot.tableSetId, tableAssignments);
    }

    if (requirements !== null) {
      await run('DELETE FROM booking_requirement WHERE booking_id = $1', [bookingId]);
      await insertRequirements(bookingId, requirements);
    }

    return findById(bookingId);
  });
};
