import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { close, run } from '../../src/dao/db.js';
import * as users from '../../src/dao/users.js';
import { hash } from '../../src/passwordHasher.js';
import { cleanBookingData, createSlot } from '../helpers/bookingFixtures.js';

// Writing, changing and deleting the menu of a slot (MH-10), through the real app and the real
// database. A slot in 2090 has not started; a slot in 2001 has, so its menu stays as it is (#59).
const PASSWORD = 'password123';
const MENU = '**Dinner**\n- Barley soup\n  - *with* speck';

const clean = async () => {
  await cleanBookingData();
  await run("DELETE FROM app_user WHERE email LIKE '%@example.com'");
};

beforeEach(clean);
afterAll(async () => {
  await clean();
  await close();
});

async function employee() {
  const agent = request.agent(app);
  await users.insert({
    firstName: 'A', lastName: 'B', email: 'menus.employee@example.com', phone: null, role: 'EMPLOYEE',
    passwordHash: await hash(PASSWORD),
  });
  await agent.post('/api/auth/login').send({ email: 'menus.employee@example.com', password: PASSWORD }).expect(200);
  return agent;
}

const setMenu = (slotId, menu) =>
  run("UPDATE slot SET menu = $2, menu_saved_at = now() WHERE id = $1", [slotId, menu]);

describe('the menu of a slot', () => {
  it('is written, read and deleted before the slot starts', async () => {
    const agent = await employee();
    const { slotId } = await createSlot({ date: '2090-07-18' });

    const saved = await agent.put(`/api/staff/slots/${slotId}/menu`).send({ menu: MENU }).expect(200);
    expect(saved.body).toMatchObject({ slotId: Number(slotId), menu: MENU });

    await agent.delete(`/api/staff/slots/${slotId}/menu`).expect(204);

    const read = await request(app).get(`/api/slots/${slotId}/menu`).expect(200);
    expect(read.body.menu).toBeNull();
  });

  it('deletes only the menu of that slot, not the same text on another slot', async () => {
    const agent = await employee();
    const first = await createSlot({ date: '2090-07-18' });
    const second = await createSlot({ date: '2090-07-19' });
    await setMenu(first.slotId, MENU);
    await setMenu(second.slotId, MENU);

    await agent.delete(`/api/staff/slots/${first.slotId}/menu`).expect(204);

    expect((await request(app).get(`/api/slots/${second.slotId}/menu`)).body.menu).toBe(MENU);
    const previous = await agent.get('/api/staff/menus').query({ search: 'Barley' }).expect(200);
    expect(previous.body.menus.map((m) => m.slotId)).toContain(Number(second.slotId));
  });

  it('cannot be changed or deleted once the slot has started', async () => {
    const agent = await employee();
    const { slotId } = await createSlot({ date: '2001-07-18' });
    await setMenu(slotId, MENU);

    const changed = await agent.put(`/api/staff/slots/${slotId}/menu`).send({ menu: 'Soup' }).expect(422);
    expect(changed.body).toMatchObject({ error: 'UnprocessableError', code: 'MENU_LOCKED' });
    const deleted = await agent.delete(`/api/staff/slots/${slotId}/menu`).expect(422);
    expect(deleted.body.code).toBe('MENU_LOCKED');

    expect((await request(app).get(`/api/slots/${slotId}/menu`)).body.menu).toBe(MENU);
  });

  it('answers 404 for a slot that does not exist, 401 without a login and 403 for a hiker', async () => {
    const agent = await employee();
    await agent.delete('/api/staff/slots/999999999/menu').expect(404);
    await request(app).delete('/api/staff/slots/1/menu').expect(401);

    const hiker = request.agent(app);
    await hiker.post('/api/auth/register')
      .send({ firstName: 'A', lastName: 'B', email: 'menus.hiker@example.com', password: PASSWORD }).expect(201);
    await hiker.delete('/api/staff/slots/1/menu').expect(403);
  });
});
