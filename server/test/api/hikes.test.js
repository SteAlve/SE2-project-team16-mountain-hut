import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { close, get, run } from '../../src/dao/db.js';
import * as users from '../../src/dao/users.js';
import { hash } from '../../src/passwordHasher.js';

const PASSWORD = 'password123';
const HIKER_EMAIL = 'mh20-hike-%@example.com';
const clean = async () => {
  await run(`DELETE FROM hike WHERE hiker_id IN (SELECT id FROM app_user WHERE email LIKE '${HIKER_EMAIL}')`);
  await run(`DELETE FROM app_user WHERE email LIKE '${HIKER_EMAIL}'`);
};

const registerHiker = async (suffix) => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({
    firstName: 'Mara',
    lastName: 'Rossi',
    email: `mh20-hike-${suffix}@example.com`,
    password: PASSWORD,
  }).expect(201);
  return agent;
};

const employee = async (suffix) => {
  const email = `mh20-hike-${suffix}@example.com`;
  const agent = request.agent(app);
  await users.insert({
    firstName: 'Staff',
    lastName: 'User',
    email,
    phone: null,
    role: 'EMPLOYEE',
    passwordHash: await hash(PASSWORD),
  });
  await agent.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return agent;
};

const hikeBody = {
  start: 'Rifugio Quintino Sella',
  destination: 'Passo Alpe Lunga',
  route: 'Via the Chiaretto lake',
  passagePoints: ['Viso Mozzo', 'Lago Chiaretto'],
  departureAt: '2090-07-18T07:30',
  returnAt: '2090-07-18T17:00',
};

beforeEach(clean);
afterAll(async () => {
  await clean();
  await close();
});

describe('MH-20 hike API', () => {
  it('registers a complete hike and lists only the current hiker hikes', async () => {
    const hiker = await registerHiker('complete');
    const saved = await hiker.post('/api/hikes').send(hikeBody).expect(201);

    expect(saved.body).toMatchObject({
      id: expect.any(Number),
      ...hikeBody,
    });
    expect((await hiker.get('/api/hikes')).body).toEqual([saved.body]);

    const other = await registerHiker('other');
    expect((await other.get('/api/hikes')).body).toEqual([]);
  });

  it('defaults an omitted start and passage points', async () => {
    const hiker = await registerHiker('defaults');
    const response = await hiker.post('/api/hikes').send({
      destination: hikeBody.destination,
      route: hikeBody.route,
      departureAt: hikeBody.departureAt,
      returnAt: hikeBody.returnAt,
    }).expect(201);

    expect(response.body).toMatchObject({ start: null, passagePoints: [] });
  });

  it('rejects invalid times and bodies without saving a hike', async () => {
    const hiker = await registerHiker('invalid');

    await hiker.post('/api/hikes').send({ ...hikeBody, returnAt: hikeBody.departureAt }).expect(400);
    await hiker.post('/api/hikes').send({ ...hikeBody, departureAt: '2001-07-18T07:30' }).expect(400);
    await hiker.post('/api/hikes').send({ ...hikeBody, destination: '' }).expect(400);
    await hiker.post('/api/hikes').send({ ...hikeBody, unknown: true }).expect(400);

    expect((await hiker.get('/api/hikes')).body).toEqual([]);
  });

  it('rejects overlapping hikes but allows one that starts when another ends', async () => {
    const hiker = await registerHiker('overlap');
    await hiker.post('/api/hikes').send(hikeBody).expect(201);

    const overlap = await hiker.post('/api/hikes').send({
      ...hikeBody,
      destination: 'Overlapping destination',
      departureAt: '2090-07-18T16:00',
      returnAt: '2090-07-18T18:00',
    }).expect(409);
    expect(overlap.body).toMatchObject({ error: 'ConflictError', code: 'HIKE_OVERLAP' });

    await hiker.post('/api/hikes').send({
      ...hikeBody,
      destination: 'Adjacent destination',
      departureAt: '2090-07-18T17:00',
      returnAt: '2090-07-18T19:00',
    }).expect(201);
  });

  it('allows only hikers to use the hike endpoints', async () => {
    await request(app).post('/api/hikes').send(hikeBody).expect(401);
    await request(app).get('/api/hikes').expect(401);

    const staff = await employee('employee');
    await staff.post('/api/hikes').send(hikeBody).expect(403);
    await staff.get('/api/hikes').expect(403);
  });

  it('persists the hike fields and keeps past hikes in the list', async () => {
    const hiker = await registerHiker('past');
    const user = await get('SELECT id FROM app_user WHERE email = $1', ['mh20-hike-past@example.com']);
    await run(
      `INSERT INTO hike (hiker_id, start_point, destination, route, passage_points, departure_at, return_at)
       VALUES ($1, $2, $3, $4, $5, '2001-07-18T07:30:00+02', '2001-07-18T17:00:00+02')`,
      [user.id, 'Old hut', 'Old destination', 'Old route', ['Old point']],
    );

    const listed = await hiker.get('/api/hikes').expect(200);
    expect(listed.body).toEqual([
      expect.objectContaining({ destination: 'Old destination', departureAt: '2001-07-18T07:30', passagePoints: ['Old point'] }),
    ]);
  });
});
