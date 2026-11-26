import { all, get, inTransaction, run } from './db.js';

// Copy operations are serialized with each other. Slot inserts and bookings still use the normal
// row/constraint locking, while this lock prevents two weekly replacements from interleaving.
const WEEK_SCHEDULE_LOCK_KEY = 20901109;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

const isIsoDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const fail = (code, message) => Object.assign(new RangeError(message), { code });

const parseDay = (value, code = 'INVALID_WEEK_START') => {
  if (!isIsoDate(value)) throw fail(code, 'Dates must use the YYYY-MM-DD format.');
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw fail(code, `${value} is not a valid calendar date.`);
  }
  return parsed;
};

const formatDay = (date) => date.toISOString().slice(0, 10);

const addDays = (date, count) => new Date(date.getTime() + count * DAY_IN_MILLISECONDS);

const overlaps = (first, second) => first.from <= second.to && second.from <= first.to;

const validateCopyIntervals = ({ sourceStart, destinationIntervals }) => {
  const sourceDate = parseDay(sourceStart);
  if (!Array.isArray(destinationIntervals) || destinationIntervals.length === 0) {
    throw fail('INVALID_DESTINATION_INTERVAL', 'At least one destination interval is required.');
  }

  const source = { from: sourceDate, to: addDays(sourceDate, 6) };
  const destinations = destinationIntervals.map((interval) => {
    if (!interval || typeof interval !== 'object') {
      throw fail('INVALID_DESTINATION_INTERVAL', 'Each destination interval must be an object.');
    }
    const from = parseDay(interval.from, 'INVALID_DESTINATION_INTERVAL');
    const to = parseDay(interval.to, 'INVALID_DESTINATION_INTERVAL');
    const days = Math.round((to.getTime() - from.getTime()) / DAY_IN_MILLISECONDS) + 1;
    if (days < 1 || days % 7 !== 0) {
      throw fail('INVALID_DESTINATION_INTERVAL', 'Each destination interval must contain whole seven-day periods.');
    }
    const daysFromSource = Math.round((from.getTime() - sourceDate.getTime()) / DAY_IN_MILLISECONDS);
    if (daysFromSource < 7 || daysFromSource % 7 !== 0) {
      throw fail(
        'INVALID_DESTINATION_INTERVAL',
        'Each destination interval must start on a continuation week after the source period.',
      );
    }
    return { from, to };
  });

  for (const destination of destinations) {
    if (overlaps(source, destination)) {
      throw fail('OVERLAPPING_WEEKS', 'Source and destination periods must not overlap.');
    }
  }
  for (let first = 0; first < destinations.length; first += 1) {
    for (let second = first + 1; second < destinations.length; second += 1) {
      if (overlaps(destinations[first], destinations[second])) {
        throw fail('OVERLAPPING_WEEKS', 'Destination periods must not overlap.');
      }
    }
  }

  return {
    sourceStart: formatDay(sourceDate),
    destinations: destinations.map(({ from, to }) => ({ from: formatDay(from), to: formatDay(to) })),
  };
};

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

// Every complete seven-day period from a day to another, with the slots and active bookings needed by
// the staff schedule-copy picker. Cancelled bookings no longer block replacement and are removed when
// their destination slots are replaced.
export const findPeriodSummaries = (from, to) => all(
  `
    WITH periods AS (
      SELECT period_start::DATE AS period_from, period_start::DATE + 6 AS period_to
      FROM generate_series($1::DATE, $2::DATE, INTERVAL '7 days') AS values(period_start)
    ),
    days AS (
      SELECT periods.period_from, periods.period_to, day::DATE AS service_date
      FROM periods
      CROSS JOIN LATERAL generate_series(
        periods.period_from,
        periods.period_to,
        INTERVAL '1 day'
      ) AS values(day)
    ),
    daily_slots AS (
      SELECT
        days.period_from,
        days.period_to,
        days.service_date,
        COUNT(slot.id)::INTEGER AS slot_count
      FROM days
      LEFT JOIN slot ON slot.service_date = days.service_date
      GROUP BY days.period_from, days.period_to, days.service_date
    ),
    period_bookings AS (
      SELECT
        periods.period_from,
        COUNT(DISTINCT booking.id)::INTEGER AS booking_count
      FROM periods
      LEFT JOIN slot
        ON slot.service_date BETWEEN periods.period_from AND periods.period_to
      LEFT JOIN booking
        ON booking.slot_id = slot.id
        AND booking.cancelled_at IS NULL
      GROUP BY periods.period_from
    )
    SELECT
      daily_slots.period_from AS "from",
      daily_slots.period_to AS "to",
      SUM(daily_slots.slot_count)::INTEGER AS "slotCount",
      period_bookings.booking_count AS "bookingCount",
      (period_bookings.booking_count = 0) AS "canReplace",
      json_agg(
        json_build_object(
          'date', daily_slots.service_date::TEXT,
          'slotCount', daily_slots.slot_count
        )
        ORDER BY daily_slots.service_date
      ) AS days
    FROM daily_slots
    JOIN period_bookings ON period_bookings.period_from = daily_slots.period_from
    GROUP BY daily_slots.period_from, daily_slots.period_to, period_bookings.booking_count
    ORDER BY daily_slots.period_from
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

/**
 * Copies one source seven-day period into one or more destination intervals. Each destination
 * interval contains one or more whole seven-day continuation periods, so a two-week interval repeats
 * the source schedule twice. Separate non-adjacent continuation intervals can be supplied in the
 * same atomic operation.
 *
 * The destination is replaced only when none of its slots has an active booking. Cancelled bookings
 * in the destination are deleted with the old slots; bookings are never copied to the new slots.
 * The whole replacement is atomic, so a refused copy leaves the destination intact.
 *
 * Returns the number of inserted and replaced slots. Errors have stable codes for the use case:
 *   INVALID_WEEK_START           the source date is not an ISO date
 *   INVALID_DESTINATION_INTERVAL a destination is malformed, not a whole number of periods, or is
 *                                not aligned after the source period
 *   OVERLAPPING_WEEKS             source/destination periods overlap
 *   EMPTY_SOURCE_WEEK             the source period contains no slots
 *   WEEK_HAS_BOOKINGS             a destination period contains at least one active booking
 */
export const copyScheduleIntervals = async ({ sourceStart, destinationIntervals }) => {
  const input = validateCopyIntervals({ sourceStart, destinationIntervals });
  return inTransaction(async () => {
    await run('SELECT pg_advisory_xact_lock($1)', [WEEK_SCHEDULE_LOCK_KEY]);

    const sourceSlots = await all(
      `
        SELECT service_date, starts_at, ends_at, table_set_id
        FROM slot
        WHERE service_date >= $1::DATE
          AND service_date < $1::DATE + 7
        ORDER BY service_date, starts_at
        FOR SHARE
      `,
      [input.sourceStart],
    );
    if (sourceSlots.length === 0) {
      throw fail('EMPTY_SOURCE_WEEK', 'The source week contains no slots.');
    }

    const intervalJson = JSON.stringify(input.destinations);
    const destinationSlots = await all(
      `
        WITH destination_intervals AS (
          SELECT "from"::DATE AS from_date, "to"::DATE AS to_date
          FROM json_to_recordset($1::JSON) AS intervals("from" TEXT, "to" TEXT)
        )
        SELECT slot.id
        FROM slot
        JOIN destination_intervals
          ON slot.service_date BETWEEN destination_intervals.from_date AND destination_intervals.to_date
        FOR UPDATE
      `,
      [intervalJson],
    );

    const destinationBooking = await get(
      `
        WITH destination_intervals AS (
          SELECT "from"::DATE AS from_date, "to"::DATE AS to_date
          FROM json_to_recordset($1::JSON) AS intervals("from" TEXT, "to" TEXT)
        )
        SELECT 1 AS found
        FROM booking
        JOIN slot ON slot.id = booking.slot_id
        JOIN destination_intervals
          ON slot.service_date BETWEEN destination_intervals.from_date AND destination_intervals.to_date
        WHERE booking.cancelled_at IS NULL
        LIMIT 1
      `,
      [intervalJson],
    );
    if (destinationBooking) {
      throw fail('WEEK_HAS_BOOKINGS', 'The destination period contains active bookings.');
    }

    await run(
      `
        WITH destination_intervals AS (
          SELECT "from"::DATE AS from_date, "to"::DATE AS to_date
          FROM json_to_recordset($1::JSON) AS intervals("from" TEXT, "to" TEXT)
        )
        DELETE FROM booking
        USING slot, destination_intervals
        WHERE booking.slot_id = slot.id
          AND slot.service_date BETWEEN destination_intervals.from_date AND destination_intervals.to_date
          AND booking.cancelled_at IS NOT NULL
      `,
      [intervalJson],
    );

    // booking_table rows are removed by the booking foreign key's ON DELETE CASCADE.
    // The remaining destination slots can then be deleted without violating booking history FKs.
    if (destinationSlots.length > 0) {
      await run(
        `
          WITH destination_intervals AS (
            SELECT "from"::DATE AS from_date, "to"::DATE AS to_date
            FROM json_to_recordset($1::JSON) AS intervals("from" TEXT, "to" TEXT)
          )
          DELETE FROM slot
          USING destination_intervals
          WHERE slot.service_date BETWEEN destination_intervals.from_date AND destination_intervals.to_date
        `,
        [intervalJson],
      );
    }

    const inserted = await run(
      `
        WITH destination_intervals AS (
          SELECT "from"::DATE AS from_date, "to"::DATE AS to_date
          FROM json_to_recordset($1::JSON) AS intervals("from" TEXT, "to" TEXT)
        ),
        source_slots AS MATERIALIZED (
          SELECT
            service_date - $2::DATE AS day_offset,
            starts_at,
            ends_at,
            table_set_id
          FROM slot
          WHERE service_date >= $2::DATE
            AND service_date < $2::DATE + 7
        ),
        target_periods AS (
          SELECT from_date + (period_number * 7) AS period_start
          FROM destination_intervals
          CROSS JOIN LATERAL generate_series(
            0,
            ((to_date - from_date) / 7)::INTEGER
          ) AS periods(period_number)
        )
        INSERT INTO slot (service_date, starts_at, ends_at, table_set_id)
        SELECT
          target_periods.period_start + source_slots.day_offset,
          source_slots.starts_at,
          source_slots.ends_at,
          source_slots.table_set_id
        FROM target_periods
        CROSS JOIN source_slots
      `,
      [intervalJson, input.sourceStart],
    );

    return { copiedSlots: inserted.rowCount, replacedSlots: destinationSlots.length };
  });
};

// Backward-compatible single-period form for callers that already use the original DAO method.
export const copyWeekSchedule = ({ sourceWeekStart, destinationWeekStart }) => copyScheduleIntervals({
  sourceStart: sourceWeekStart,
  destinationIntervals: [{
    from: destinationWeekStart,
    to: formatDay(addDays(parseDay(destinationWeekStart), 6)),
  }],
});

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
