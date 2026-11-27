import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { close, run } from '../../src/dao/db.js';
import * as bookings from '../../src/dao/bookings.js';
import * as users from '../../src/dao/users.js';
import { hash } from '../../src/passwordHasher.js';
import { cleanBookingData, createHiker, createSlot } from '../helpers/bookingFixtures.js';

const PASSWORD = 'password123';

const clean = async () => {
  await cleanBookingData();
  await run("DELETE FROM app_user WHERE email LIKE 'copy-api-%@example.com'");
};

const loggedIn = async (email, role = 'EMPLOYEE') => {
  const agent = request.agent(app);
  await users.insert({
    firstName: 'Test',
    lastName: 'Staff',
    email,
    phone: null,
    role,
    passwordHash: await hash(PASSWORD),
  });
  await agent.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return agent;
};

beforeEach(clean);
afterAll(async () => {
  await clean();
  await close();
});

describe('MH-09 staff schedule endpoints access', () => {
  it.each([
    ['get', '/api/staff/slots/weeks?from=2090-10-02&to=2090-10-08'],
    ['post', '/api/staff/slots/copy-week'],
  ])('answers 401 without login: %s %s', async (method, path) => {
    const response = method === 'get'
      ? await request(app).get(path)
      : await request(app).post(path).send({ sourceStart: '2090-10-02', destinationIntervals: [{ from: '2090-10-09', to: '2090-10-15' }] });
    expect(response.status).toBe(401);
  });

  it('answers 403 for a hiker on both endpoints', async () => {
    const hiker = await loggedIn(`copy-api-hiker-${randomUUID()}@example.com`, 'HIKER');
    expect((await hiker.get('/api/staff/slots/weeks').query({ from: '2090-10-02', to: '2090-10-08' })).status).toBe(403);
    expect((await hiker.post('/api/staff/slots/copy-week').send({
      sourceStart: '2090-10-02',
      destinationIntervals: [{ from: '2090-10-09', to: '2090-10-15' }],
    })).status).toBe(403);
  });
});

describe('GET /api/staff/slots/weeks', () => {
  it('returns seven-day summaries starting at the selected day', async () => {
    const employee = await loggedIn(`copy-api-list-${randomUUID()}@example.com`);
    await createSlot({ date: '2090-10-02' });
    await createSlot({ date: '2090-10-09' });

    const response = await employee.get('/api/staff/slots/weeks')
      .query({ from: '2090-10-02', to: '2090-10-15' })
      .expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body[0]).toMatchObject({
      from: '2090-10-02',
      to: '2090-10-08',
      slotCount: 1,
      bookingCount: 0,
      canReplace: true,
    });
    expect(response.body[0].days).toHaveLength(7);
    expect(response.body[1]).toMatchObject({ from: '2090-10-09', to: '2090-10-15', slotCount: 1 });
  });

  it('answers 400 for a range that is not complete periods', async () => {
    const employee = await loggedIn(`copy-api-list-invalid-${randomUUID()}@example.com`);
    const response = await employee.get('/api/staff/slots/weeks')
      .query({ from: '2090-10-02', to: '2090-10-09' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'ValidationError', message: 'from and to must delimit complete seven-day periods' });
  });
});

describe('POST /api/staff/slots/copy-week', () => {
  it('copies the selected source period into a continuation period', async () => {
    const employee = await loggedIn(`copy-api-copy-${randomUUID()}@example.com`);
    await createSlot({ date: '2090-11-02' });
    await createSlot({ date: '2090-11-09' });

    const response = await employee.post('/api/staff/slots/copy-week').send({
      sourceStart: '2090-11-02',
      destinationIntervals: [{ from: '2090-11-09', to: '2090-11-15' }],
    }).expect(200);

    expect(response.body).toEqual({ copiedSlots: 1, replacedSlots: 1 });
    const slots = (await employee.get('/api/staff/slots').query({ from: '2090-11-09', to: '2090-11-15' }).expect(200)).body;
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ date: '2090-11-09', startsAt: '12:00', endsAt: '13:00' });
  });

  it('answers 400 for invalid body and an unaligned continuation', async () => {
    const employee = await loggedIn(`copy-api-invalid-${randomUUID()}@example.com`);
    await expect(employee.post('/api/staff/slots/copy-week').send({ sourceStart: '2090-11-02', destinationIntervals: [] })).resolves.toMatchObject({ status: 400 });

    const response = await employee.post('/api/staff/slots/copy-week').send({
      sourceStart: '2090-11-02',
      destinationIntervals: [{ from: '2090-11-08', to: '2090-11-14' }],
    });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: 'ValidationError' });
  });

  it('answers 409 when a destination has a booking', async () => {
    const employee = await loggedIn(`copy-api-conflict-${randomUUID()}@example.com`);
    await createSlot({ date: '2090-12-02' });
    const booked = await createSlot({ date: '2090-12-09' });
    const hiker = await createHiker(`copy-api-booked-${randomUUID()}@example.com`);
    await bookings.createWithTableAssignments({
      hikerId: hiker.id,
      slotId: booked.slotId,
      partySize: 1,
      tableAssignments: [{ tableId: booked.tableIds[0], seatCount: 1 }],
    });

    const response = await employee.post('/api/staff/slots/copy-week').send({
      sourceStart: '2090-12-02',
      destinationIntervals: [{ from: '2090-12-09', to: '2090-12-15' }],
    });
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ error: 'ConflictError', code: 'WEEK_HAS_BOOKINGS' });
  });
});
