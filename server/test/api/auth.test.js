import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { close, run } from '../../src/dao/db.js';
import { DEMO_PASSWORD, DEMO_STAFF, seedStaff } from '../../scripts/seed.js';

const body = {
  firstName: 'Api', lastName: 'Test', email: 'Api.Test@example.com',
  phone: '+39 333 1234567', password: 'password123',
};
const cleanup = () => run("DELETE FROM app_user WHERE email LIKE '%@example.com'");
const sid = (res) => res.headers['set-cookie']?.find((c) => c.startsWith('sid='));

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await close();
});

describe('POST /api/auth/register', () => {
  it('creates a HIKER, sets a hardened cookie and logs in', async () => {
    const res = await request(app).post('/api/auth/register').send(body);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: 'api.test@example.com', role: 'HIKER', phone: '+39 333 1234567' });
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('password');
    const cookie = sid(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);

    const me = await request(app).get('/api/auth/me').set('Cookie', cookie.split(';')[0]);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('api.test@example.com');
  });

  it('answers 409 for a duplicate email, case-insensitively', async () => {
    await request(app).post('/api/auth/register').send(body);
    const res = await request(app).post('/api/auth/register').send({ ...body, email: 'API.TEST@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ConflictError');
  });

  it('answers 400 for invalid input and does not let the client choose a role', async () => {
    const short = await request(app).post('/api/auth/register').send({ ...body, password: 'short' });
    expect(short.status).toBe(400);
    expect(short.body.error).toBe('ValidationError');

    const role = await request(app).post('/api/auth/register').send({ ...body, role: 'WARDEN' });
    expect(role.status).toBe(400);
  });
});

describe('login / me / logout', () => {
  it('runs the whole cycle', async () => {
    await request(app).post('/api/auth/register').send(body);

    const login = await request(app).post('/api/auth/login').send({ email: 'api.test@example.com', password: body.password });
    expect(login.status).toBe(200);
    const cookie = sid(login).split(';')[0];

    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(200);

    const out = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(204);

    const after = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(after.status).toBe(401);
  });

  it('answers 401 with the same message for a wrong password and an unknown email', async () => {
    await request(app).post('/api/auth/register').send(body);
    const wrong = await request(app).post('/api/auth/login').send({ email: body.email, password: 'wrongwrong' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'no@example.com', password: 'wrongwrong' });

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(sid(wrong)).toBeUndefined();
  });

  it('answers 400 for a login without password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@example.com' });
    expect(res.status).toBe(400);
  });

  it('gives a new session id on every login', async () => {
    await request(app).post('/api/auth/register').send(body);
    const creds = { email: body.email, password: body.password };
    const a = await request(app).post('/api/auth/login').send(creds);
    const b = await request(app).post('/api/auth/login').send(creds);
    expect(sid(a).split(';')[0]).not.toBe(sid(b).split(';')[0]);
  });

  it('answers 401 on /me without cookie or with a forged one', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Cookie', 'sid=forged')).status).toBe(401);
  });

  it('logout without a session is still 204', async () => {
    expect((await request(app).post('/api/auth/logout')).status).toBe(204);
  });

  it('logs in a seeded staff member with the role in the answer', async () => {
    await seedStaff();
    const warden = DEMO_STAFF.find((s) => s.role === 'WARDEN');
    const res = await request(app).post('/api/auth/login').send({ email: warden.email, password: DEMO_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('WARDEN');
  });
});
