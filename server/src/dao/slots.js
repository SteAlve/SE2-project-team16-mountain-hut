import { all, get, inTransaction, run } from './db.js';

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

// The slot with that id (with its menu, null when it has none), or null. Dates and times are read
// as text: the driver would turn a DATE into a JavaScript Date at local midnight, which moves the day
// on a server in another time zone.
// The id is compared as a BIGINT: the API ids are int64 and the column is an INTEGER, so an id
// above 2147483647 must be a slot that does not exist, not an "out of range" error (500).
export const findById = (slotId) => get(
  `
    SELECT
      id AS "slotId",
      service_date::TEXT AS "serviceDate",
      starts_at::TEXT AS "startsAt",
      ends_at::TEXT AS "endsAt",
      table_set_id AS "tableSetId",
      menu
    FROM slot
    WHERE id = $1::BIGINT
  `,
  [slotId],
);

// Every slot from a day to another, both included, in order of day and time (the staff view: slots
// without tables too), each with its menu (null when it has none). Its table set is read with the
// table set dao.
export const findBetween = (from, to) => all(
  `
    SELECT
      id AS "slotId",
      service_date AS "serviceDate",
      starts_at AS "startsAt",
      ends_at AS "endsAt",
      table_set_id AS "tableSetId",
      menu
    FROM slot
    WHERE service_date BETWEEN $1 AND $2
    ORDER BY service_date, starts_at
  `,
  [from, to],
);

// The constraints that refuse a slot because of another slot of the day.
const SLOT_RULES = new Set(['slot_unique_start', 'slot_no_overlap']);

// Creates a slot. Returns its id, or null when another slot of that day overlaps it, one starting at
// the same time included (the constraints slot_unique_start and slot_no_overlap decide, so two requests
// at the same time cannot both succeed). A slot that starts when another ends does not overlap it.
// Any other error (a primary key conflict, for example) is thrown. The savepoint of inTransaction
// keeps a transaction around it usable after a refused slot.
export const insert = async ({ serviceDate, startsAt, endsAt, tableSetId }) => {
  try {
    return await inTransaction(() => get(
      `
        INSERT INTO slot (service_date, starts_at, ends_at, table_set_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id AS "slotId"
      `,
      [serviceDate, startsAt, endsAt, tableSetId],
    ));
  } catch (error) {
    if (SLOT_RULES.has(error.constraint)) return null;
    throw error;
  }
};

// The first slot of that day that overlaps the times, or null. One that starts when the other ends
// does not overlap it.
export const findOverlapping = ({ serviceDate, startsAt, endsAt }) => get(
  `
    SELECT id AS "slotId", starts_at::TEXT AS "startsAt", ends_at::TEXT AS "endsAt"
    FROM slot
    WHERE service_date = $1 AND starts_at < $3::TIME AND ends_at > $2::TIME
    ORDER BY starts_at
    LIMIT 1
  `,
  [serviceDate, startsAt, endsAt],
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

// ---------- MH-10: the menu of a slot ----------

// The menu of the slot with that id, with the day and the times of the slot, or null when there is no
// such slot. menu is null when the slot has no menu yet. The id is compared as a BIGINT (see findById).
export const findMenuById = (slotId) => get(
  `
    SELECT
      id AS "slotId",
      service_date::TEXT AS "serviceDate",
      starts_at::TEXT AS "startsAt",
      ends_at::TEXT AS "endsAt",
      menu
    FROM slot
    WHERE id = $1::BIGINT
  `,
  [slotId],
);

// Saves the menu of a slot, replacing the one it had: the last save wins. Returns the menu of the slot
// as findMenuById does, or null when there is no such slot.
export const saveMenu = (slotId, menu, savedAt) => get(
  `
    UPDATE slot SET menu = $2, menu_saved_at = $3
    WHERE id = $1::BIGINT
    RETURNING
      id AS "slotId",
      service_date::TEXT AS "serviceDate",
      starts_at::TEXT AS "startsAt",
      ends_at::TEXT AS "endsAt",
      menu
  `,
  [slotId, menu, savedAt],
);

// Deletes the menu of a slot: the slot is left with no menu. Returns false when there is no such slot.
export const deleteMenu = async (slotId) => (await get(
  `
    UPDATE slot SET menu = NULL, menu_saved_at = NULL
    WHERE id = $1::BIGINT
    RETURNING id
  `,
  [slotId],
)) !== null;

// The text of a search, safe inside LIKE: % and _ match themselves.
const likePattern = (text) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

// The menus already written, to start a new one from (MH-10), newest first. The same text is listed
// once, with the last slot it was saved for (with a search, the last one that matches it). exceptSlotId
// leaves out the slot being edited; the same text saved on another slot is still listed, with that slot.
// search (optional) finds a dish in the text or a day, written as 2026-12-12, "Sat 12 Dec" or
// "Saturday 12 December". Returns { menus, hasMore }: hasMore says that older menus are left.
export const findPreviousMenus = async ({ exceptSlotId = null, search = null, limit, offset = 0 }) => {
  const rows = await all(
    `
      SELECT "slotId", "serviceDate", "startsAt", "endsAt", menu
      FROM (
        SELECT DISTINCT ON (menu)
          id AS "slotId",
          service_date::TEXT AS "serviceDate",
          starts_at::TEXT AS "startsAt",
          ends_at::TEXT AS "endsAt",
          menu,
          menu_saved_at
        FROM slot
        WHERE menu IS NOT NULL
          AND ($1::BIGINT IS NULL OR id <> $1::BIGINT)
          AND (
            $2::TEXT IS NULL
            OR menu ILIKE $2
            OR service_date::TEXT LIKE $2
            OR to_char(service_date, 'Dy FMDD Mon YYYY') ILIKE $2
            OR to_char(service_date, 'FMDay FMDD FMMonth YYYY') ILIKE $2
          )
        ORDER BY menu, menu_saved_at DESC, id DESC
      ) AS last_use
      ORDER BY menu_saved_at DESC, "slotId" DESC
      LIMIT $3 OFFSET $4
    `,
    [exceptSlotId, search === null ? null : likePattern(search), limit + 1, offset],
  );
  return { menus: rows.slice(0, limit), hasMore: rows.length > limit };
};
