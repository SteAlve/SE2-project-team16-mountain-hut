import { all } from './db.js';

export const findBookableByDate = (serviceDate) => all(
  `
    WITH booked_seats AS (
      SELECT
        booking_table.slot_id,
        booking_table.table_set_table_id,
        SUM(booking_table.seat_count)::INTEGER AS seat_count
      FROM booking_table
      JOIN booking ON booking.id = booking_table.booking_id
      WHERE booking.cancelled_at IS NULL
      GROUP BY booking_table.slot_id, booking_table.table_set_table_id
    ),
    slot_availability AS (
      SELECT
        slot.id,
        slot.starts_at,
        slot.ends_at,
        SUM(table_set_table.seat_capacity - COALESCE(booked_seats.seat_count, 0))::INTEGER
          AS free_seats
      FROM slot
      JOIN table_set_table ON table_set_table.table_set_id = slot.table_set_id
      LEFT JOIN booked_seats
        ON booked_seats.slot_id = slot.id
        AND booked_seats.table_set_table_id = table_set_table.id
      WHERE slot.service_date = $1
      GROUP BY slot.id
    )
    SELECT
      id AS "slotId",
      starts_at::TEXT AS "startsAt",
      ends_at::TEXT AS "endsAt",
      free_seats AS "freeSeats"
    FROM slot_availability
    WHERE free_seats > 0
    ORDER BY starts_at
  `,
  [serviceDate],
);
