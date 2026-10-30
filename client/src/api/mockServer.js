/**
 * API (dev only): a fake server in memory, used by `npm run dev:mock` instead of the Express server.
 * It answers like docs/openapi.json, so the pages can be checked without the backend.
 * It is never part of the production build (request.js imports it only in mock mode).
 *
 * The data is built from today, so every case of the booking page is always there:
 *   today            12:00 and 13:00 are closed once less than 2 hours are left
 *   today + 1        19:00 has 2 free seats; 20:00 always answers 409 (the seats were just taken)
 *   today + 2        no slots (the hut is closed)
 *   today + 3        12:00 always answers 422 (the booking closed meanwhile)
 *   other days       plenty of seats
 *
 * Logged in as a hiker at start. "Log out" makes you a guest (booking then answers 401) until
 * POST /auth/login or a reload. Bookings lower the free seats until the page is reloaded.
 */

const DELAY_MS = 400;

const SLOTS = [
  { slotId: 1, startsAt: '12:00:00', endsAt: '13:00:00' },
  { slotId: 2, startsAt: '13:00:00', endsAt: '14:00:00' },
  { slotId: 3, startsAt: '19:00:00', endsAt: '20:00:00' },
  { slotId: 4, startsAt: '20:00:00', endsAt: '21:00:00' },
];

const HIKER = {
  id: 1,
  firstName: 'Anna',
  lastName: 'Rossi',
  email: 'anna.rossi@example.com',
  phone: '+39 333 123 4567',
  role: 'HIKER',
};

// Days from today: 0 for today, 1 for tomorrow...
const dayOffset = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  const today = new Date();
  return Math.round((new Date(y, m - 1, d) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 864e5);
};

let user = HIKER;
let nextBookingId = 1;
const freeSeats = {}; // 'YYYY-MM-DD#slotId' -> seats

function seatsOf(day, slotId) {
  const key = `${day}#${slotId}`;
  if (!(key in freeSeats)) {
    const offset = dayOffset(day);
    freeSeats[key] = offset === 1 && slotId === 3 ? 2 : 6 + ((offset * 7 + slotId * 5) % 15);
  }
  return freeSeats[key];
}

const slotsOf = (day) =>
  dayOffset(day) === 2 ? [] : SLOTS.map((slot) => ({ ...slot, freeSeats: seatsOf(day, slot.slotId) }));

const json = (status, body) =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const fail = (status, error, message) => json(status, { error, message });

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
    const day = url.searchParams.get('date');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? '')) return fail(400, 'ValidationError', 'date must be YYYY-MM-DD');
    return json(200, slotsOf(day));
  }

  if (method === 'POST' && path === '/bookings') {
    if (!user) return fail(401, 'UnauthorizedError', 'Log in to book a table');
    if (user.role !== 'HIKER') return fail(403, 'ForbiddenError', 'Only hikers can book a table');
    const { date, slotId, partySize } = body ?? {};
    const slot = slotsOf(date).find((s) => s.slotId === slotId);
    if (!slot || !(partySize >= 1)) return fail(400, 'ValidationError', 'Invalid booking');

    const offset = dayOffset(date);
    if (offset === 3 && slotId === 1) return fail(422, 'BookingClosedError', 'Booking for this time is closed');
    if (offset === 1 && slotId === 4) {
      freeSeats[`${date}#${slotId}`] = 1;
      return fail(409, 'ConflictError', 'Not enough free seats');
    }
    if (slot.freeSeats < partySize) return fail(409, 'ConflictError', 'Not enough free seats');

    freeSeats[`${date}#${slotId}`] -= partySize;
    return json(201, { id: nextBookingId++, date, slotId, partySize });
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
