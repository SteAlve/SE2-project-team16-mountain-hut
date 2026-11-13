import { all, get, run } from './db.js';

// Every slot from that date on (the day included), full or without tables too, with the free seats
// of its tables (0 when it has no tables). Ordered by day and time.
export const findFromDate = (serviceDate) => all(
  `
    WITH booked_seats AS (
      SELECT
        booking_table.slot_id,
        booking_table.hut_table_id,
        SUM(booking_table.seat_count)::INTEGER AS seat_count
      FROM booking_table
      JOIN booking ON booking.id = booking_table.booking_id
      JOIN slot ON slot.id = booking_table.slot_id
      WHERE booking.cancelled_at IS NULL
        AND slot.service_date >= $1
      GROUP BY booking_table.slot_id, booking_table.hut_table_id
    )
    SELECT
      slot.id AS "slotId",
      slot.service_date::TEXT AS "date",
      slot.starts_at::TEXT AS "startsAt",
      slot.ends_at::TEXT AS "endsAt",
      COALESCE(
        SUM(hut_table.seat_capacity - COALESCE(booked_seats.seat_count, 0)),
        0
      )::INTEGER AS "freeSeats"
    FROM slot
    LEFT JOIN hut_table ON hut_table.table_set_id = slot.table_set_id
    LEFT JOIN booked_seats
      ON booked_seats.slot_id = slot.id
      AND booked_seats.hut_table_id = hut_table.id
    WHERE slot.service_date >= $1
    GROUP BY slot.id, slot.service_date, slot.starts_at, slot.ends_at
    ORDER BY slot.service_date, slot.starts_at
  `,
  [serviceDate],
);

// exceptBookingId (MH-06): the seats of that booking count as free, so a booking being changed can
// keep or reuse its own seats.
export const findAvailableTablesBySlotId = (slotId, { exceptBookingId = null } = {}) => all(
  `
    SELECT
      hut_table.id AS "tableId",
      hut_table.table_number AS "tableNumber",
      hut_table.seat_capacity AS "seatCapacity",
      hut_table.seat_capacity - COALESCE(booked_seats.seat_count, 0) AS "freeSeats"
    FROM slot
    JOIN hut_table ON hut_table.table_set_id = slot.table_set_id
    LEFT JOIN (
      SELECT
        booking_table.hut_table_id,
        SUM(booking_table.seat_count)::INTEGER AS seat_count
      FROM booking_table
      JOIN booking ON booking.id = booking_table.booking_id
      WHERE booking.slot_id = $1
        AND booking.cancelled_at IS NULL
        AND ($2::INTEGER IS NULL OR booking.id <> $2)
      GROUP BY booking_table.hut_table_id
    ) AS booked_seats ON booked_seats.hut_table_id = hut_table.id
    WHERE slot.id = $1
      AND hut_table.seat_capacity - COALESCE(booked_seats.seat_count, 0) > 0
    ORDER BY hut_table.id
  `,
  [slotId, exceptBookingId],
);

// The slot with that id, or null. Dates and times are read as text: the driver would turn a DATE
// into a JavaScript Date at local midnight, which moves the day on a server in another time zone.
// The id is compared as a BIGINT: the API ids are int64 and the column is an INTEGER, so an id
// above 2147483647 must be a slot that does not exist, not an "out of range" error (500).
export const findById = (slotId) => get(
  `
    SELECT
      id AS "slotId",
      service_date::TEXT AS "serviceDate",
      starts_at::TEXT AS "startsAt",
      ends_at::TEXT AS "endsAt",
      table_set_id AS "tableSetId"
    FROM slot
    WHERE id = $1::BIGINT
  `,
  [slotId],
);

// Every slot from a day to another, both included, in order of day and time (the staff view: slots
// without tables too). Only the slot: its table set is read with the table set dao.
export const findBetween = (from, to) => all(
  `
    SELECT
      id AS "slotId",
      service_date AS "serviceDate",
      starts_at AS "startsAt",
      ends_at AS "endsAt",
      table_set_id AS "tableSetId"
    FROM slot
    WHERE service_date BETWEEN $1 AND $2
    ORDER BY service_date, starts_at
  `,
  [from, to],
);

// Creates a slot. Returns its id, or null when a slot starting at that time already exists that day
// (the unique constraint decides).
export const insert = ({ serviceDate, startsAt, endsAt, tableSetId }) => get(
  `
    INSERT INTO slot (service_date, starts_at, ends_at, table_set_id)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT ON CONSTRAINT slot_unique_start DO NOTHING
    RETURNING id AS "slotId"
  `,
  [serviceDate, startsAt, endsAt, tableSetId],
);

// Gives the table set to a slot that has none. Returns true when it did, false when the slot has a
// table set already (the condition is in the UPDATE, so two requests cannot both win).
export const assignTableSet = async (slotId, tableSetId) => {
  const result = await run(
    'UPDATE slot SET table_set_id = $2 WHERE id = $1 AND table_set_id IS NULL',
    [slotId, tableSetId],
  );
  return result.rowCount === 1;
};
