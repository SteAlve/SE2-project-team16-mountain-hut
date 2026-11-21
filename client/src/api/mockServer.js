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
 * My bookings (MH-06): the hiker starts with three bookings, and GET /bookings lists them with canChange and
 * changeableUntil (48 hours before the meal). PATCH /bookings/:id changes one like the server: only what is sent
 * changes, the party is seated again with its own seats counted as free, the 48 hours count for the booking and
 * for the new time (422), and
 *   today + 1        the first booking: past the 48 hours, so Edit is faded
 *   today + 8, 20:00 the first change to this time answers 409 BOOKING_CHANGED (changed at the same moment)
 * DELETE /bookings/:id cancels one (MH-08) at any time: its seats are free again and it leaves the list; a booking
 * already cancelled answers 422.
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
let bookingChangedOnce = false;

// The bookings of the hiker: { id, userId, slotId, partySize, tables, requirements, cancelled }.
const bookings = [];

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

// MH-06: a change is admitted until 48 hours before the meal, and the new meal must start 48 hours from now.
const NOTICE_MS = 48 * 60 * 60 * 1000;
const startOf = (date, startsAt) => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = startsAt.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
};
const changeDeadline = (slot) => new Date(startOf(slot.date, slot.startsAt).getTime() - NOTICE_MS);
const toMoment = (date) => `${toDay(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
const closedChanges = () => fail(422, 'UnprocessableError', 'Bookings can be changed until 48 hours before the meal');

// The dietary needs of a booking (MH-05), saved as the server does: one per guest, at most one per
// person, texts trimmed (null when not sent), hasAllergies worked out. null when they are wrong.
const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
function toRequirements(requirements = [], partySize) {
  if (!Array.isArray(requirements) || requirements.length > partySize) return null;
  const saved = requirements.map((r) => ({
    diets: r?.diets ?? [],
    otherDiet: text(r?.otherDiet),
    allergies: r?.allergies ?? [],
    otherAllergy: text(r?.otherAllergy),
    otherRequests: text(r?.otherRequests),
  }));
  const empty = (r) => !r.diets.length && !r.allergies.length && !r.otherDiet && !r.otherAllergy && !r.otherRequests;
  if (saved.some(empty)) return null;
  return saved.map((r) => ({ ...r, hasAllergies: r.allergies.length > 0 || r.otherAllergy !== null }));
}

// The three bookings the hiker starts with (MH-06): one past the 48 hours, two that can be changed.
function seedBookings() {
  const need = (diets, allergies) => ({ diets, otherDiet: null, allergies, otherAllergy: null, otherRequests: null, hasAllergies: allergies.length > 0 });
  [
    { offset: 1, meal: 0, partySize: 2, requirements: [] },
    { offset: 5, meal: 1, partySize: 4, requirements: [need(['VEGAN'], ['PEANUTS']), need([], ['SHELLFISH'])] },
    { offset: 9, meal: 2, partySize: 6, requirements: [need(['VEGETARIAN'], ['SHELLFISH', 'PEANUTS', 'GLUTEN']), need(['LACTOSE_FREE'], []), need(['VEGAN'], [])] },
  ].forEach(({ offset, meal, partySize, requirements }) => {
    const slot = SLOTS.find((s) => isSlot(s, offset, meal));
    const tables = seat(slot, partySize);
    tables.forEach(({ tableNumber, seats }) => { slot.tables.find((t) => t.tableNumber === tableNumber).free -= seats; });
    bookings.push({ id: nextBookingId++, userId: HIKER.id, slotId: slot.slotId, partySize, tables, requirements });
    booked.add(`${HIKER.id}#${slot.slotId}`);
  });
}
seedBookings();

const toMyBooking = (b) => {
  const slot = SLOTS.find((s) => s.slotId === b.slotId);
  return {
    id: b.id,
    slotId: b.slotId,
    date: slot.date,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    partySize: b.partySize,
    tables: b.tables,
    requirements: b.requirements,
  };
};

const slotOf = (b) => SLOTS.find((s) => s.slotId === b.slotId);
const giveSeats = (b, sign) =>
  b.tables.forEach(({ tableNumber, seats }) => { slotOf(b).tables.find((t) => t.tableNumber === tableNumber).free += sign * seats; });

// DELETE /bookings/:id, like the server (docs/openapi.json, cancelBooking): no time limit.
function cancelMyBooking(id) {
  if (!user) return fail(401, 'UnauthorizedError', 'Authentication required');
  if (user.role !== 'HIKER') return fail(403, 'ForbiddenError', 'Only hikers can cancel bookings');
  const booking = bookings.find((b) => b.id === id && b.userId === user.id);
  if (!booking) return fail(404, 'NotFoundError', `Booking ${id} not found`);
  if (booking.cancelled) return fail(422, 'UnprocessableError', 'This booking was already cancelled');
  booking.cancelled = true;
  giveSeats(booking, +1);
  booked.delete(`${user.id}#${booking.slotId}`);
  return json(204, null);
}

// PATCH /bookings/:id, like the server (docs/openapi.json, changeBooking).
function changeMyBooking(id, body) {
  if (!user) return fail(401, 'UnauthorizedError', 'Authentication required');
  if (user.role !== 'HIKER') return fail(403, 'ForbiddenError', 'Only hikers can change bookings');
  const booking = bookings.find((b) => b.id === id && b.userId === user.id);
  if (!booking) return fail(404, 'NotFoundError', `Booking ${id} not found`);
  if (booking.cancelled) return fail(422, 'UnprocessableError', 'This booking was cancelled');
  const keys = Object.keys(body ?? {});
  if (keys.length === 0) return fail(400, 'ValidationError', 'Send at least one of slotId, partySize and requirements');
  if (keys.some((k) => !['slotId', 'partySize', 'requirements'].includes(k))) {
    return fail(400, 'ValidationError', `Unknown field: ${keys.find((k) => !['slotId', 'partySize', 'requirements'].includes(k))}`);
  }
  if (body.partySize !== undefined && !(Number.isInteger(body.partySize) && body.partySize >= 1)) {
    return fail(400, 'ValidationError', 'partySize must be a positive integer');
  }

  const current = slotOf(booking);
  if (Date.now() > changeDeadline(current).getTime()) return closedChanges();
  const target = body.slotId === undefined ? current : SLOTS.find((s) => s.slotId === body.slotId);
  if (!target) return fail(404, 'NotFoundError', `Slot ${body.slotId} not found`);
  if (target !== current && startOf(target.date, target.startsAt).getTime() - Date.now() < NOTICE_MS) return closedChanges();
  if (target !== current && booked.has(`${user.id}#${target.slotId}`)) {
    return fail(422, 'UnprocessableError', 'You already have a booking for this slot');
  }

  const partySize = body.partySize ?? booking.partySize;
  let requirements = booking.requirements;
  if (body.requirements !== undefined) {
    if (!Array.isArray(body.requirements)) return fail(400, 'ValidationError', 'requirements must be a list');
    if (body.requirements.length > partySize) {
      return fail(422, 'UnprocessableError', 'There can be at most one requirement per person of the party');
    }
    requirements = toRequirements(body.requirements, partySize);
    if (!requirements) return fail(400, 'ValidationError', 'Invalid requirements');
  } else if (requirements.length > partySize) {
    return fail(422, 'UnprocessableError', 'There can be at most one requirement per person of the party');
  }

  let tables = booking.tables;
  if (target !== current || partySize !== booking.partySize) {
    if (isSlot(target, 8, 3) && !bookingChangedOnce) {
      bookingChangedOnce = true;
      return fail(409, 'ConflictError', 'The booking was changed in the meantime: reload it and try again', 'BOOKING_CHANGED');
    }
    // The seats of the booking count as free, so it can keep them.
    giveSeats(booking, +1);
    const proposed = seat(target, partySize);
    if (!proposed) {
      giveSeats(booking, -1);
      return noSeats();
    }
    proposed.forEach(({ tableNumber, seats }) => { target.tables.find((t) => t.tableNumber === tableNumber).free -= seats; });
    booked.delete(`${user.id}#${current.slotId}`);
    booked.add(`${user.id}#${target.slotId}`);
    tables = proposed;
  }

  Object.assign(booking, { slotId: target.slotId, partySize, tables, requirements });
  return json(200, toMyBooking(booking));
}

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
    const requirements = toRequirements(body.requirements, partySize);
    if (!requirements) return fail(400, 'ValidationError', 'Invalid requirements');
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
    const id = nextBookingId++;
    bookings.push({ id, userId: user.id, slotId, partySize, tables: requested, requirements });
    return json(201, { id, date: slot.date, slotId, partySize, tables: requested, requirements });
  }

  if (method === 'GET' && path === '/bookings') {
    if (!user) return fail(401, 'UnauthorizedError', 'Authentication required');
    if (user.role !== 'HIKER') return fail(403, 'ForbiddenError', 'Only hikers have bookings');
    const list = bookings
      .filter((b) => b.userId === user.id && !b.cancelled && slotOf(b).date >= toDay(new Date()))
      .sort((a, b) => `${slotOf(a).date}${slotOf(a).startsAt}`.localeCompare(`${slotOf(b).date}${slotOf(b).startsAt}`))
      .map((b) => {
        const deadline = changeDeadline(slotOf(b));
        return { ...toMyBooking(b), canChange: Date.now() <= deadline.getTime(), changeableUntil: toMoment(deadline) };
      });
    return json(200, list);
  }

  const change = path.match(/^\/bookings\/(\d+)$/);
  if (method === 'PATCH' && change) return changeMyBooking(Number(change[1]), body);
  if (method === 'DELETE' && change) return cancelMyBooking(Number(change[1]));

  return fail(404, 'NotFoundError', `No mock for ${method} ${path}`);
}

// Same signature as fetch, so request.js does not change its handling of the answers.
export async function mockFetch(input, options = {}) {
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  const url = new URL(input, window.location.origin);
  const body = options.body ? JSON.parse(options.body) : undefined;
  return route((options.method ?? 'GET').toUpperCase(), url, body);
}
