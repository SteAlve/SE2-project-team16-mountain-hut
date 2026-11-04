import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { close, run } from '../../src/dao/db.js';
import * as users from '../../src/dao/users.js';
import { hash } from '../../src/passwordHasher.js';
import { cleanBookingData } from '../helpers/bookingFixtures.js';

// The staff endpoints (MH-02), through the real app and the real database. The dates are in 2090 and
// the table sets are named "test-", so cleanBookingData() removes what a test creates.
const PASSWORD = 'password123';
const DAY = '2090-08-10';

const clean = async () => {
  await cleanBookingData();
  await run("DELETE FROM app_user WHERE email LIKE '%@example.com'");
};

beforeEach(clean);
afterAll(async () => {
  await clean();
  await close();
});

// A logged-in agent. Hikers sign up; an employee or the warden is created in the database.
async function loggedIn(email, role = 'EMPLOYEE') {
  const agent = request.agent(app);
  if (role === 'HIKER') {
    await agent.post('/api/auth/register').send({ firstName: 'A', lastName: 'B', email, password: PASSWORD }).expect(201);
  } else {
    await users.insert({ firstName: 'A', lastName: 'B', email, phone: null, role, passwordHash: await hash(PASSWORD) });
    await agent.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  }
  return agent;
}

const T = (tableNumber, capacity) => ({ tableNumber, capacity });
const uniqueName = () => `test-${randomUUID()}`;

const createSet = async (agent, tables = [T(1, 4), T(2, 2)]) =>
  (await agent.post('/api/staff/table-sets').send({ name: uniqueName(), tables }).expect(201)).body;

const createSlot = async (agent, body) => (await agent.post('/api/staff/slots').send(body).expect(201)).body;

const slotBody = (startsAt = '12:00', endsAt = '13:00', extra = {}) => ({ date: DAY, startsAt, endsAt, ...extra });

const listStaffSlots = async (agent, from = DAY, to = DAY) =>
  (await agent.get('/api/staff/slots').query({ from, to }).expect(200)).body;

describe('access to the staff endpoints', () => {
  const ENDPOINTS = [
    ['post', '/api/staff/table-sets', { name: 'test-access', tables: [T(1, 2)] }],
    ['get', '/api/staff/table-sets'],
    ['post', '/api/staff/slots', slotBody()],
    ['get', `/api/staff/slots?from=${DAY}&to=${DAY}`],
    ['put', '/api/staff/slots/1/table-set', { tableSetId: 1 }],
  ];

  const call = (client, [method, path, body]) => {
    const req = client[method](path);
    return body === undefined ? req : req.send(body);
  };

  it.each(ENDPOINTS)('answers 401 without a login: %s %s', async (...endpoint) => {
    expect((await call(request(app), endpoint)).status).toBe(401);
  });

  it.each(ENDPOINTS)('answers 403 for a hiker: %s %s', async (...endpoint) => {
    const hiker = await loggedIn('staff.hiker@example.com', 'HIKER');

    const res = await call(hiker, endpoint);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'ForbiddenError', message: 'Only the staff can do this' });
  });

  it('lets the employee and the warden in', async () => {
    const employee = await loggedIn('staff.employee@example.com', 'EMPLOYEE');
    const warden = await loggedIn('staff.warden@example.com', 'WARDEN');

    expect((await employee.get('/api/staff/table-sets')).status).toBe(200);
    expect((await warden.get('/api/staff/table-sets')).status).toBe(200);
  });
});

describe('POST /api/staff/table-sets', () => {
  it('creates a set and answers with its tables, in order of number, and its seats', async () => {
    const employee = await loggedIn('sets.create@example.com');
    const name = uniqueName();

    const res = await employee.post('/api/staff/table-sets').send({ name, tables: [T(3, 6), T(1, 2), T(2, 4)] });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      tableSetId: expect.any(Number),
      name,
      tables: [T(1, 2), T(2, 4), T(3, 6)],
      totalSeats: 12,
    });
  });

  it('answers 409 for a name already used, also when another member of the staff asks', async () => {
    const employee = await loggedIn('sets.first@example.com');
    const warden = await loggedIn('sets.second@example.com', 'WARDEN');
    const name = uniqueName();
    await employee.post('/api/staff/table-sets').send({ name, tables: [T(1, 2)] }).expect(201);

    const res = await warden.post('/api/staff/table-sets').send({ name, tables: [T(1, 8)] });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'ConflictError', message: `A table set named ${name} already exists` });
    const sets = (await employee.get('/api/staff/table-sets')).body.filter((set) => set.name === name);
    expect(sets).toHaveLength(1);
    expect(sets[0].totalSeats).toBe(2);
  });

  it.each([
    ['no name', { tables: [T(1, 2)] }, 'name is required'],
    ['an empty name', { name: '   ', tables: [T(1, 2)] }, 'name is required'],
    ['no tables', { name: 'test-x' }, 'tables must be a non-empty array'],
    ['an empty list of tables', { name: 'test-x', tables: [] }, 'tables must be a non-empty array'],
    ['a table number used twice', { name: 'test-x', tables: [T(1, 2), T(1, 4)] }, 'tableNumber values must be unique'],
    ['a table with no seats', { name: 'test-x', tables: [T(1, 0)] }, 'capacity must be a positive integer'],
    ['a table number that is not a number', { name: 'test-x', tables: [T('1', 2)] }, 'tableNumber must be a positive integer'],
    ['the seats of the booking instead of the capacity', { name: 'test-x', tables: [{ tableNumber: 1, seats: 2 }] }, 'Unknown field in tables: seats'],
    ['an unknown field', { name: 'test-x', tables: [T(1, 2)], color: 'red' }, 'Unknown field: color'],
  ])('answers 400 for %s', async (_label, body, message) => {
    const employee = await loggedIn('sets.invalid@example.com');

    const res = await employee.post('/api/staff/table-sets').send(body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'ValidationError', message });
  });

  it('answers 400 for a body that is not JSON', async () => {
    const employee = await loggedIn('sets.json@example.com');

    const res = await employee.post('/api/staff/table-sets').set('Content-Type', 'application/json').send('{"name":');

    expect(res.status).toBe(400);
  });
});

describe('GET /api/staff/table-sets', () => {
  it('lists the sets with their tables and seats, so that one can be reused', async () => {
    const employee = await loggedIn('sets.list@example.com');
    const lunch = await createSet(employee, [T(1, 4), T(2, 4)]);
    const dinner = await createSet(employee, [T(1, 6)]);

    const res = await employee.get('/api/staff/table-sets');

    expect(res.status).toBe(200);
    expect(res.body.filter((set) => [lunch.tableSetId, dinner.tableSetId].includes(set.tableSetId))).toEqual([lunch, dinner]);
  });
});

describe('POST /api/staff/slots', () => {
  it('creates a slot with a table set, and shows the set and its seats', async () => {
    const employee = await loggedIn('slots.create@example.com');
    const tableSet = await createSet(employee, [T(1, 4), T(2, 2)]);

    const res = await employee.post('/api/staff/slots').send(slotBody('12:00', '13:30', { tableSetId: tableSet.tableSetId }));

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      slotId: expect.any(Number),
      date: DAY,
      startsAt: '12:00',
      endsAt: '13:30',
      tableSet,
      totalSeats: 6,
    });
  });

  it('creates a slot without a table set: it has no seats yet', async () => {
    const employee = await loggedIn('slots.noset@example.com');

    const res = await employee.post('/api/staff/slots').send(slotBody());

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ slotId: expect.any(Number), date: DAY, startsAt: '12:00', endsAt: '13:00', tableSet: null, totalSeats: 0 });
  });

  it('creates more slots on one day, also one after the other, and lists them in order of time', async () => {
    const employee = await loggedIn('slots.many@example.com');
    const tableSet = await createSet(employee);
    const dinner = await createSlot(employee, slotBody('19:00', '21:00', { tableSetId: tableSet.tableSetId }));
    const second = await createSlot(employee, slotBody('13:00', '14:00', { tableSetId: tableSet.tableSetId }));
    const first = await createSlot(employee, slotBody('12:00', '13:00', { tableSetId: tableSet.tableSetId }));

    const listed = await listStaffSlots(employee);

    expect(listed.map((slot) => slot.slotId)).toEqual([first.slotId, second.slotId, dinner.slotId]);
  });

  it('answers 409 for a second slot that starts at the same time on that day', async () => {
    const employee = await loggedIn('slots.same@example.com');
    await createSlot(employee, slotBody('12:00', '13:00'));

    const res = await employee.post('/api/staff/slots').send(slotBody('12:00', '14:00'));

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'ConflictError', message: `A slot starting at 12:00 already exists on ${DAY}` });
    expect(await listStaffSlots(employee)).toHaveLength(1);
  });

  it('allows the same start time on another day', async () => {
    const employee = await loggedIn('slots.otherday@example.com');
    await createSlot(employee, slotBody('12:00', '13:00'));

    expect((await employee.post('/api/staff/slots').send({ ...slotBody('12:00', '13:00'), date: '2090-08-11' })).status).toBe(201);
  });

  it('creates one slot and answers 409 to the other when two slots with the same start arrive at the same time', async () => {
    const employee = await loggedIn('slots.race1@example.com');
    const warden = await loggedIn('slots.race2@example.com', 'WARDEN');

    const results = await Promise.all([
      employee.post('/api/staff/slots').send(slotBody('12:00', '13:00')),
      warden.post('/api/staff/slots').send(slotBody('12:00', '14:00')),
    ]);

    expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
    expect(await listStaffSlots(employee)).toHaveLength(1);
  });

  it('answers 404 for a table set that does not exist, and creates nothing', async () => {
    const employee = await loggedIn('slots.nosuch@example.com');

    const res = await employee.post('/api/staff/slots').send(slotBody('12:00', '13:00', { tableSetId: 999999999 }));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'NotFoundError', message: 'Table set 999999999 not found' });
    expect(await listStaffSlots(employee)).toEqual([]);
  });

  it.each([
    ['no date', { startsAt: '12:00', endsAt: '13:00' }, 'date must be a valid date'],
    ['a day that does not exist', { date: '2090-02-30', startsAt: '12:00', endsAt: '13:00' }, 'date must be a valid date'],
    ['a start that is not a time', { date: DAY, startsAt: '25:00', endsAt: '26:00' }, 'startsAt must be a valid time (HH:MM)'],
    ['an end that is not a time', { date: DAY, startsAt: '12:00', endsAt: '13' }, 'endsAt must be a valid time (HH:MM)'],
    ['an end before the start', { date: DAY, startsAt: '13:00', endsAt: '12:00' }, 'endsAt must be after startsAt'],
    ['an end equal to the start', { date: DAY, startsAt: '12:00', endsAt: '12:00' }, 'endsAt must be after startsAt'],
    ['a table set that is not a number', { date: DAY, startsAt: '12:00', endsAt: '13:00', tableSetId: 0 }, 'tableSetId must be a positive integer'],
    ['an unknown field', { date: DAY, startsAt: '12:00', endsAt: '13:00', seats: 10 }, 'Unknown field: seats'],
  ])('answers 400 for %s', async (_label, body, message) => {
    const employee = await loggedIn('slots.invalid@example.com');

    const res = await employee.post('/api/staff/slots').send(body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'ValidationError', message });
  });
});

describe('GET /api/staff/slots', () => {
  it('lists the slots of the period, both days included, in order, with their table set and the ones without', async () => {
    const employee = await loggedIn('slots.list@example.com');
    const tableSet = await createSet(employee);
    await createSlot(employee, { date: '2090-08-09', startsAt: '12:00', endsAt: '13:00' });
    const lunch = await createSlot(employee, { date: '2090-08-10', startsAt: '12:00', endsAt: '13:00', tableSetId: tableSet.tableSetId });
    const dinner = await createSlot(employee, { date: '2090-08-10', startsAt: '19:00', endsAt: '21:00' });
    const next = await createSlot(employee, { date: '2090-08-11', startsAt: '12:00', endsAt: '13:00', tableSetId: tableSet.tableSetId });
    await createSlot(employee, { date: '2090-08-12', startsAt: '12:00', endsAt: '13:00' });

    const res = await employee.get('/api/staff/slots').query({ from: '2090-08-10', to: '2090-08-11' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([lunch, dinner, next]);
    expect(res.body[1]).toMatchObject({ tableSet: null, totalSeats: 0 });
  });

  it('answers an empty list for a period without slots', async () => {
    const employee = await loggedIn('slots.empty@example.com');

    const res = await employee.get('/api/staff/slots').query({ from: '2090-09-01', to: '2090-09-30' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it.each([
    ['no dates', {}, 'from must be a valid date'],
    ['no end', { from: DAY }, 'to must be a valid date'],
    ['a date that does not exist', { from: '2090-02-30', to: DAY }, 'from must be a valid date'],
    ['a date that is not a date', { from: DAY, to: 'tomorrow' }, 'to must be a valid date'],
    ['an end before the start', { from: '2090-08-11', to: DAY }, 'to must not be before from'],
  ])('answers 400 for %s', async (_label, query, message) => {
    const employee = await loggedIn('slots.badquery@example.com');

    const res = await employee.get('/api/staff/slots').query(query);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'ValidationError', message });
  });
});

describe('PUT /api/staff/slots/:slotId/table-set', () => {
  const give = (agent, slotId, tableSetId) => agent.put(`/api/staff/slots/${slotId}/table-set`).send({ tableSetId });

  it('gives a table set to a slot that has none, and the slot is listed with it', async () => {
    const employee = await loggedIn('put.give@example.com');
    const tableSet = await createSet(employee, [T(1, 4), T(2, 2)]);
    const slot = await createSlot(employee, slotBody());

    const res = await give(employee, slot.slotId, tableSet.tableSetId);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ...slot, tableSet, totalSeats: 6 });
    expect(await listStaffSlots(employee)).toEqual([res.body]);
  });

  it('can be repeated: the same set again changes nothing and answers 200', async () => {
    const employee = await loggedIn('put.repeat@example.com');
    const tableSet = await createSet(employee);
    const slot = await createSlot(employee, slotBody());

    const first = await give(employee, slot.slotId, tableSet.tableSetId);
    const again = await give(employee, slot.slotId, tableSet.tableSetId);

    expect(again.status).toBe(200);
    expect(again.body).toEqual(first.body);
  });

  it('answers 409 for a different set, and the slot keeps the first one', async () => {
    const employee = await loggedIn('put.different@example.com');
    const first = await createSet(employee, [T(1, 4)]);
    const other = await createSet(employee, [T(1, 8)]);
    const slot = await createSlot(employee, slotBody('12:00', '13:00', { tableSetId: first.tableSetId }));

    const res = await give(employee, slot.slotId, other.tableSetId);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'ConflictError', message: `Slot ${slot.slotId} already has a different table set` });
    expect((await listStaffSlots(employee))[0].tableSet.tableSetId).toBe(first.tableSetId);
  });

  it('gives the same set to many slots without entering the tables again', async () => {
    const employee = await loggedIn('put.many@example.com');
    const tableSet = await createSet(employee, [T(1, 4), T(2, 4)]);
    const lunch = await createSlot(employee, slotBody('12:00', '13:00'));
    const afternoon = await createSlot(employee, slotBody('13:00', '14:00'));

    expect((await give(employee, lunch.slotId, tableSet.tableSetId)).status).toBe(200);
    expect((await give(employee, afternoon.slotId, tableSet.tableSetId)).status).toBe(200);

    expect((await listStaffSlots(employee)).map((slot) => slot.totalSeats)).toEqual([8, 8]);
  });

  it('answers 404 for a slot that does not exist, and for a table set that does not exist', async () => {
    const employee = await loggedIn('put.missing@example.com');
    const tableSet = await createSet(employee);
    const slot = await createSlot(employee, slotBody());

    const noSlot = await give(employee, 999999999, tableSet.tableSetId);
    const noSet = await give(employee, slot.slotId, 999999999);

    expect(noSlot.status).toBe(404);
    expect(noSlot.body).toEqual({ error: 'NotFoundError', message: 'Slot 999999999 not found' });
    expect(noSet.status).toBe(404);
    expect(noSet.body).toEqual({ error: 'NotFoundError', message: 'Table set 999999999 not found' });
  });

  it.each([
    ['a slot id that is not a number', 'abc', { tableSetId: 1 }, 'slotId must be a positive integer'],
    ['a slot id of 0', '0', { tableSetId: 1 }, 'slotId must be a positive integer'],
    ['no table set', '1', {}, 'tableSetId must be a positive integer'],
    ['a table set that is a text', '1', { tableSetId: '1' }, 'tableSetId must be a positive integer'],
    ['an unknown field', '1', { tableSetId: 1, force: true }, 'Unknown field: force'],
  ])('answers 400 for %s', async (_label, slotId, body, message) => {
    const employee = await loggedIn('put.invalid@example.com');

    const res = await employee.put(`/api/staff/slots/${slotId}/table-set`).send(body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'ValidationError', message });
  });

  it('answers 409 to the one that loses when two of the staff give different sets at the same time', async () => {
    const employee = await loggedIn('put.race1@example.com');
    const warden = await loggedIn('put.race2@example.com', 'WARDEN');
    const a = await createSet(employee, [T(1, 4)]);
    const b = await createSet(employee, [T(1, 8)]);
    const slot = await createSlot(employee, slotBody());

    const results = await Promise.all([give(employee, slot.slotId, a.tableSetId), give(warden, slot.slotId, b.tableSetId)]);

    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    const winner = results.find((res) => res.status === 200).body.tableSet.tableSetId;
    expect((await listStaffSlots(employee))[0].tableSet.tableSetId).toBe(winner);
  });

  it('answers 200 to both when two of the staff give the same set at the same time', async () => {
    const employee = await loggedIn('put.same1@example.com');
    const warden = await loggedIn('put.same2@example.com', 'WARDEN');
    const tableSet = await createSet(employee);
    const slot = await createSlot(employee, slotBody());

    const results = await Promise.all([
      give(employee, slot.slotId, tableSet.tableSetId),
      give(warden, slot.slotId, tableSet.tableSetId),
    ]);

    expect(results.map((res) => res.status)).toEqual([200, 200]);
  });
});

describe('what the staff defines is what a hiker can book (MH-01)', () => {
  const slotOf = async (slotId) => (await request(app).get('/api/slots')).body.find((slot) => slot.slotId === slotId);

  it('shows a slot with its seats, proposes the tables and takes the booking', async () => {
    const employee = await loggedIn('flow.employee@example.com');
    const hiker = await loggedIn('flow.hiker@example.com', 'HIKER');
    const tableSet = await createSet(employee, [T(1, 4), T(2, 2)]);
    const slot = await createSlot(employee, slotBody('12:00', '13:00', { tableSetId: tableSet.tableSetId }));

    expect(await slotOf(slot.slotId)).toMatchObject({ freeSeats: 6, bookingOpen: true });

    const preview = await request(app).get(`/api/slots/${slot.slotId}/seating`).query({ partySize: 5 });
    expect(preview.status).toBe(200);
    expect(preview.body.tables).toEqual([{ tableNumber: 1, seats: 4 }, { tableNumber: 2, seats: 1 }]);

    const booked = await hiker.post('/api/bookings').send({ slotId: slot.slotId, partySize: 5, tables: preview.body.tables });
    expect(booked.status).toBe(201);

    expect(await slotOf(slot.slotId)).toMatchObject({ freeSeats: 1 });
    expect((await listStaffSlots(employee))[0].totalSeats).toBe(6);
  });

  it('keeps a slot without a table set at 0 seats, and nothing can be booked until it gets one', async () => {
    const employee = await loggedIn('flow2.employee@example.com');
    const hiker = await loggedIn('flow2.hiker@example.com', 'HIKER');
    const slot = await createSlot(employee, slotBody());
    const tableSet = await createSet(employee, [T(1, 4)]);

    expect(await slotOf(slot.slotId)).toMatchObject({ freeSeats: 0 });
    const refused = await hiker.post('/api/bookings').send({ slotId: slot.slotId, partySize: 2, tables: [{ tableNumber: 1, seats: 2 }] });
    expect(refused.status).toBe(422);

    await employee.put(`/api/staff/slots/${slot.slotId}/table-set`).send({ tableSetId: tableSet.tableSetId }).expect(200);

    expect(await slotOf(slot.slotId)).toMatchObject({ freeSeats: 4 });
    const booked = await hiker.post('/api/bookings').send({ slotId: slot.slotId, partySize: 2, tables: [{ tableNumber: 1, seats: 2 }] });
    expect(booked.status).toBe(201);
  });
});

describe('ids that do not exist, also the very large ones', () => {
  // openapi.json gives the ids as int64 and says that an id that does not exist is a 404. The columns
  // are INTEGER, so an id above 2147483647 must be looked up without an "out of range" error (500).
  it('answers 404 for a table set id above the largest integer of the database, when creating a slot', async () => {
    const employee = await loggedIn('big.slot@example.com');

    const res = await employee.post('/api/staff/slots').send(slotBody('12:00', '13:00', { tableSetId: 3000000000 }));

    expect(res.status).toBe(404);
  });

  it('answers 404 for a slot id above the largest integer of the database, when giving a set', async () => {
    const employee = await loggedIn('big.put@example.com');
    const tableSet = await createSet(employee);

    const res = await employee.put('/api/staff/slots/3000000000/table-set').send({ tableSetId: tableSet.tableSetId });

    expect(res.status).toBe(404);
  });

  it('answers 404 for a table set id above the largest integer of the database, when giving a set', async () => {
    const employee = await loggedIn('big.set@example.com');
    const slot = await createSlot(employee, slotBody());

    const res = await employee.put(`/api/staff/slots/${slot.slotId}/table-set`).send({ tableSetId: 3000000000 });

    expect(res.status).toBe(404);
  });
});
