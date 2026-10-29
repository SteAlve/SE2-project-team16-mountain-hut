import { all, get } from './db.js';

// Every slot from that date on (the day included), full or without tables too, with the free seats
// of its tables (0 when it has no tables). Ordered by day and time.
export const findFromDate = (serviceDate) => all(
  `
    WITH booked_seats AS (
      SELECT
        booking_table.slot_id,
        booking_table.table_set_table_id,
        SUM(booking_table.seat_count)::INTEGER AS seat_count
      FROM booking_table
      JOIN booking ON booking.id = booking_table.booking_id
      JOIN slot ON slot.id = booking_table.slot_id
      WHERE booking.cancelled_at IS NULL
        AND slot.service_date >= $1
      GROUP BY booking_table.slot_id, booking_table.table_set_table_id
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
      AND booked_seats.table_set_table_id = hut_table.id
    WHERE slot.service_date >= $1
    GROUP BY slot.id
    ORDER BY slot.service_date, slot.starts_at
  `,
  [serviceDate],
);

export const findAvailableTablesBySlotId = (slotId) => all(
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
        booking_table.table_set_table_id,
        SUM(booking_table.seat_count)::INTEGER AS seat_count
      FROM booking_table
      JOIN booking ON booking.id = booking_table.booking_id
      WHERE booking.slot_id = $1
        AND booking.cancelled_at IS NULL
      GROUP BY booking_table.table_set_table_id
    ) AS booked_seats ON booked_seats.table_set_table_id = hut_table.id
    WHERE slot.id = $1
      AND hut_table.seat_capacity - COALESCE(booked_seats.seat_count, 0) > 0
    ORDER BY hut_table.id
  `,
  [slotId],
);

// The slot with that id, or null. (Same fields as findByIdAndDate.)
export const findById = (slotId) => get(
  `
    SELECT
      id AS "slotId",
      service_date::TEXT AS "serviceDate",
      starts_at::TEXT AS "startsAt",
      ends_at::TEXT AS "endsAt",
      table_set_id AS "tableSetId"
    FROM slot
    WHERE id = $1
  `,
  [slotId],
);

// The slot of that date, or null. Dates and times are read as text: the driver would turn a DATE
// into a JavaScript Date at local midnight, which moves the day on a server in another time zone.
export const findByIdAndDate = (slotId, serviceDate) => get(
  `
    SELECT
      id AS "slotId",
      service_date::TEXT AS "serviceDate",
      starts_at::TEXT AS "startsAt",
      ends_at::TEXT AS "endsAt",
      table_set_id AS "tableSetId"
    FROM slot
    WHERE id = $1 AND service_date = $2
  `,
  [slotId, serviceDate],
);
