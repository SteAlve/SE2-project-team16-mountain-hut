/**
 * API (dev only): a fake server in memory, used by `npm run dev:mock` instead of the Express server.
 * It answers like docs/openapi.json, so the pages can be checked without the backend.
 * It is never part of the production build (request.js imports it only in mock mode).
 *
 * The data is built from today (the next 60 days), so every case of the booking page is always there:
 *   today            12:00 and 13:00 are closed once less than 2 hours are left
 *   today + 1        19:00 has 2 free seats; 20:00 always answers 409 NO_SEATS (the seats were just taken)
 *   today + 2        no slots (the hut is closed)
 *   today + 3        12:00 answers 422 on booking (the booking closed meanwhile);
 *                    13:00 answers 409 TABLES_CHANGED the first time (someone took a table)
 *   other days       plenty of seats, a party is split over tables when no table is big enough
 *
 * Logged in as a hiker at start. "Log out" makes you a guest (booking then answers 401) until
 * POST /auth/login or a reload. Bookings take the seats until the page is reloaded.
 */
const DELAY_MS = 400;
const DAYS = 60;

const MEALS = [
  { startsAt: '12:00', endsAt: '13:00' },
  { startsAt: '13:00', endsAt: '14:00' },
  { startsAt: '19:00', endsAt: '20:00' },
  { startsAt: '20:00', endsAt: '21:00' },
];
const LAYOUTS = [[2, 2, 4, 4, 6], [2, 3, 4, 6, 8], [4, 6, 6, 8]];

const HIKER = {
  id: 1,
  firstName: 'Anna',
  lastName: 'Rossi',
  email: 'anna.rossi@example.com',
  phone: '+39 333 123 4567',
  role: 'HIKER',
};

const pad = (n) => String(n).padStart(2, '0');
const toDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const nextDays = (count) => {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => toDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)));
};
// Booking closes 2 hours before the meal.
const closingTime = (date, startsAt) => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = startsAt.split(':').map(Number);
  return new Date(y, m - 1, d, h - 2, min);
};
const isClosed = (date, startsAt) => Date.now() > closingTime(date, startsAt).getTime();

// The slots of the next days: [{ slotId, date, startsAt, endsAt, offset, meal, tables: [{ tableNumber, free }] }].
const SLOTS = nextDays(DAYS).flatMap((date, offset) =>
  offset === 2
    ? []
    : MEALS.map((meal, i) => ({
        slotId: offset * MEALS.length + i + 1,
        date,
        ...meal,
        offset,
        meal: i,
        tables: (offset === 1 && i === 2 ? [2] : LAYOUTS[(offset + i) % LAYOUTS.length])
          .map((free, t) => ({ tableNumber: t + 1, free })),
      })),
);

let user = HIKER;
let nextBookingId = 1;
let tablesChangedOnce = false;
const booked = new Set(); // 'userId#slotId'

const freeSeats = (slot) => slot.tables.reduce((sum, t) => sum + t.free, 0);
const isSlot = (slot, offset, meal) => slot.offset === offset && slot.meal === meal;

const toSlotDto = (slot) => {
  const closes = closingTime(slot.date, slot.startsAt);
  return {
    slotId: slot.slotId,
    date: slot.date,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    freeSeats: freeSeats(slot),
    bookingOpen: !isClosed(slot.date, slot.startsAt),
    bookingClosesAt: `${toDay(closes)}T${pad(closes.getHours())}:${pad(closes.getMinutes())}`,
  };
};

// Simpler than the server, enough to try the page: the smallest table that fits, otherwise the
// biggest tables first. [{ tableNumber, seats }] sorted by table, or null.
function seat(slot, partySize) {
  const free = slot.tables.filter((t) => t.free > 0);
  const single = free.filter((t) => t.free >= partySize).sort((a, b) => a.free - b.free)[0];
  if (single) return [{ tableNumber: single.tableNumber, seats: partySize }];
  let left = partySize;
  const tables = [];
  for (const t of [...free].sort((a, b) => b.free - a.free)) {
    if (left === 0) break;
    const seats = Math.min(t.free, left);
    tables.push({ tableNumber: t.tableNumber, seats });
    left -= seats;
  }
  return left > 0 ? null : tables.sort((a, b) => a.tableNumber - b.tableNumber);
}

const sameTables = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const json = (status, body) =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const fail = (status, error, message, code) => json(status, { error, message, ...(code && { code }) });
const noSeats = () => fail(409, 'ConflictError', 'Not enough free seats', 'NO_SEATS');

// The checks the seating preview and the booking share: null when the slot can be booked.
function checkOpen(slot, slotId) {
  if (!slot) return fail(404, 'NotFoundError', `Slot ${slotId} not found`);
  if (isClosed(slot.date, slot.startsAt)) {
    return fail(422, 'UnprocessableError', 'Bookings close two hours before the meal');
  }
  return null;
}

function route(method, url, body) {
  const path = url.pathname.replace(/^\/api/, '');

  if (method === 'GET' && path === '/auth/me') {
    return user ? json(200, user) : fail(401, 'UnauthorizedError', 'Not logged in');
  }
  if (method === 'POST' && (path === '/auth/login' || path === '/auth/register')) {
    user = { ...HIKER, ...(body?.email && { email: body.email }) };
    return json(path === '/auth/login' ? 200 : 201, user);
  }
  if (method === 'POST' && path === '/auth/logout') {
    user = null;
    return json(204, null);
  }

  if (method === 'GET' && path === '/slots') {
    return json(200, SLOTS.map(toSlotDto));
  }

  const seating = path.match(/^\/slots\/(\d+)\/seating$/);
  if (method === 'GET' && seating) {
    const slotId = Number(seating[1]);
    const partySize = Number(url.searchParams.get('partySize'));
    if (!(partySize >= 1)) return fail(400, 'ValidationError', 'partySize must be a positive integer');
    const slot = SLOTS.find((s) => s.slotId === slotId);
    const closed = checkOpen(slot, slotId);
    if (closed) return closed;
    const tables = seat(slot, partySize);
    return tables ? json(200, { slotId, partySize, tables }) : noSeats();
  }

  if (method === 'POST' && path === '/bookings') {
    if (!user) return fail(401, 'UnauthorizedError', 'Authentication required');
    if (user.role !== 'HIKER') return fail(403, 'ForbiddenError', 'Only hikers can create bookings');
    const { slotId, partySize, tables } = body ?? {};
    if (!(partySize >= 1) || !Array.isArray(tables)) return fail(400, 'ValidationError', 'Invalid booking');
    const slot = SLOTS.find((s) => s.slotId === slotId);
    const closed = checkOpen(slot, slotId);
    if (closed) return closed;
    if (booked.has(`${user.id}#${slotId}`)) {
      return fail(422, 'UnprocessableError', 'You already have a booking for this slot');
    }

    if (isSlot(slot, 3, 0)) return fail(422, 'UnprocessableError', 'Bookings close two hours before the meal');
    if (isSlot(slot, 1, 3)) {
      slot.tables.forEach((t, i) => { t.free = i === 0 ? 1 : 0; });
      return noSeats();
    }
    if (isSlot(slot, 3, 1) && !tablesChangedOnce) {
      tablesChangedOnce = true;
      const taken = slot.tables.find((t) => t.tableNumber === tables[0]?.tableNumber);
      if (taken) taken.free = 0;
    }

    const proposed = seat(slot, partySize);
    if (!proposed) return noSeats();
    const requested = [...tables].sort((a, b) => a.tableNumber - b.tableNumber);
    if (!sameTables(requested, proposed)) {
      return fail(409, 'ConflictError', 'The chosen tables are no longer the ones proposed for this party', 'TABLES_CHANGED');
    }

    proposed.forEach(({ tableNumber, seats }) => {
      slot.tables.find((t) => t.tableNumber === tableNumber).free -= seats;
    });
    booked.add(`${user.id}#${slotId}`);
    return json(201, { id: nextBookingId++, date: slot.date, slotId, partySize, tables: requested });
  }

  return fail(404, 'NotFoundError', `No mock for ${method} ${path}`);
}

// Same signature as fetch, so request.js does not change its handling of the answers.
export async function mockFetch(input, options = {}) {
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  const url = new URL(input, window.location.origin);
  const body = options.body ? JSON.parse(options.body) : undefined;
  return route((options.method ?? 'GET').toUpperCase(), url, body);
}
