import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { close, run } from '../../src/dao/db.js';
import * as users from '../../src/dao/users.js';
import { hash } from '../../src/passwordHasher.js';
import { cleanBookingData, createSlot } from '../helpers/bookingFixtures.js';

const PASSWORD = 'password123';
const MENU = '**Dinner**\n- Barley soup\n  - *with* speck';

const clean = async () => {
  await cleanBookingData();
  await run("DELETE FROM app_user WHERE email LIKE 'mh10-menu-%@example.com'");
};

const employee = async (suffix = 'employee') => {
  const email = `mh10-menu-${suffix}@example.com`;
  const agent = request.agent(app);
  await users.insert({
    firstName: 'Menu',
    lastName: 'Employee',
    email,
    phone: null,
    role: 'EMPLOYEE',
    passwordHash: await hash(PASSWORD),
  });
  await agent.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return agent;
};

const setMenuDirectly = (slotId, menu) => run(
  'UPDATE slot SET menu = $2, menu_saved_at = now() WHERE id = $1',
  [slotId, menu],
);

beforeEach(clean);
afterAll(async () => {
  await clean();
  await close();
});

describe('MH-10 menu API', () => {
  it('writes, reads and deletes a menu for a future slot', async () => {
    const agent = await employee('future');
    const { slotId } = await createSlot({ date: '2090-07-18' });

    const saved = await agent.put(`/api/staff/slots/${slotId}/menu`).send({ menu: MENU }).expect(200);
    expect(saved.body).toMatchObject({ slotId: Number(slotId), date: '2090-07-18', menu: MENU });

    await request(app).get(`/api/slots/${slotId}/menu`).expect(200).then(({ body }) => {
      expect(body.menu).toBe(MENU);
    });
    await agent.delete(`/api/staff/slots/${slotId}/menu`).expect(204);
    await request(app).get(`/api/slots/${slotId}/menu`).expect(200).then(({ body }) => {
      expect(body.menu).toBeNull();
    });
  });

  it('changes one slot without changing another slot with the same menu', async () => {
    const agent = await employee('independent');
    const first = await createSlot({ date: '2090-07-18' });
    const second = await createSlot({ date: '2090-07-19' });
    await agent.put(`/api/staff/slots/${first.slotId}/menu`).send({ menu: MENU }).expect(200);
    await agent.put(`/api/staff/slots/${second.slotId}/menu`).send({ menu: MENU }).expect(200);

    await agent.put(`/api/staff/slots/${first.slotId}/menu`).send({ menu: 'Soup' }).expect(200);
    expect((await request(app).get(`/api/slots/${first.slotId}/menu`)).body.menu).toBe('Soup');
    expect((await request(app).get(`/api/slots/${second.slotId}/menu`)).body.menu).toBe(MENU);
  });

  it('lists previous menus once and supports search and exceptSlotId', async () => {
    const agent = await employee('previous');
    const first = await createSlot({ date: '2090-07-18' });
    const second = await createSlot({ date: '2090-07-19' });
    await agent.put(`/api/staff/slots/${first.slotId}/menu`).send({ menu: MENU }).expect(200);
    await agent.put(`/api/staff/slots/${second.slotId}/menu`).send({ menu: MENU }).expect(200);

    const previous = await agent.get('/api/staff/menus').query({ search: 'barley' }).expect(200);
    expect(previous.body.menus).toHaveLength(1);
    expect(previous.body.menus[0]).toMatchObject({ menu: MENU });

    const excludingSecond = await agent.get('/api/staff/menus')
      .query({ exceptSlotId: second.slotId, search: 'barley' })
      .expect(200);
    expect(excludingSecond.body.menus[0].slotId).toBe(Number(first.slotId));
  });

  it('keeps a started slot menu fixed', async () => {
    const agent = await employee('started');
    const { slotId } = await createSlot({ date: '2001-07-18' });
    await setMenuDirectly(slotId, MENU);

    await agent.put(`/api/staff/slots/${slotId}/menu`).send({ menu: 'Soup' }).expect(422);
    await agent.delete(`/api/staff/slots/${slotId}/menu`).expect(422);
    expect((await request(app).get(`/api/slots/${slotId}/menu`)).body.menu).toBe(MENU);
  });

  it('validates menu content and protects staff endpoints', async () => {
    const agent = await employee('validation');
    const { slotId } = await createSlot({ date: '2090-07-18' });

    const invalid = await agent.put(`/api/staff/slots/${slotId}/menu`).send({ menu: '# Heading' }).expect(400);
    expect(invalid.body.code).toBe('MENU_FORMAT');
    expect((await request(app).get(`/api/slots/${slotId}/menu`)).body.menu).toBeNull();

    await request(app).put(`/api/staff/slots/${slotId}/menu`).send({ menu: 'Soup' }).expect(401);
    await request(app).delete(`/api/staff/slots/999999999/menu`).expect(401);

    const hiker = request.agent(app);
    const email = 'mh10-menu-hiker@example.com';
    await users.insert({
      firstName: 'Menu',
      lastName: 'Hiker',
      email,
      phone: null,
      role: 'HIKER',
      passwordHash: await hash(PASSWORD),
    });
    await hiker.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
    await hiker.put(`/api/staff/slots/${slotId}/menu`).send({ menu: 'Soup' }).expect(403);
  });
});
