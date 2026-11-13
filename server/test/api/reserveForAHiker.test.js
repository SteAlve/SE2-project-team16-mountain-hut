// Reserve for a Hiker integration tests: the real Express app, PostgreSQL database and local SMTP server.
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { startSmtpInbox } from '../helpers/smtpInbox.js';

const inbox = await startSmtpInbox();

// These must be set before app.js and its mailer are imported.
Object.assign(process.env, {
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: String(inbox.port),
  SMTP_USER: '',
  SMTP_PASSWORD: '',
  MAIL_FROM: 'QUOTA <no-reply@quota.example>',
});

const { app } = await import('../../src/app.js');
const { close, get, run } = await import('../../src/dao/db.js');
const { hash } = await import('../../src/passwordHasher.js');
const { cleanBookingData, createSlot } = await import('../helpers/bookingFixtures.js');

const PASSWORD = 'password123';

const clean = async () => {
  await cleanBookingData();
  await run("DELETE FROM app_user WHERE email LIKE '%@example.com' OR temporary");
};

beforeEach(async () => {
  await clean();
  inbox.clear();
});

afterAll(async () => {
  await clean();
  await close();
  await inbox.stop();
});

async function staff(email = 'reserve.hiker.staff@example.com') {
  await get(
    `INSERT INTO app_user (first_name, last_name, email, role, password_hash)
     VALUES ('Test', 'Employee', $1, 'EMPLOYEE', $2)`,
    [email, await hash(PASSWORD)],
  );
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return agent;
}

async function registeredHiker(email = 'reserve.hiker.user@example.com') {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({
    firstName: 'Test', lastName: 'Hiker', email, password: PASSWORD,
  }).expect(201);
  return agent;
}

async function waitForEmails(count) {
  await vi.waitFor(() => expect(inbox.emails).toHaveLength(count), { timeout: 2000, interval: 10 });
}

describe('Reserve for a Hiker — staff hiker and password flows', () => {
  it('creates an account, forces the first password change, then unlocks the user', async () => {
    const employee = await staff();
    const created = await employee.post('/api/staff/hikers').send({
      firstName: 'Luca', lastName: 'Bianchi', email: 'luca.bianchi@example.com', phone: '+39 333 1234567',
    }).expect(201);

    expect(created.body).toMatchObject({
      firstName: 'Luca', lastName: 'Bianchi', email: 'luca.bianchi@example.com', temporary: false,
    });
    expect(created.body).not.toHaveProperty('password');
    expect(inbox.emails).toHaveLength(1);
    const generatedPassword = inbox.emails[0].text.match(/^Password: (.+)$/m)?.[1];
    expect(generatedPassword).toBeTruthy();

    const hiker = request.agent(app);
    const login = await hiker.post('/api/auth/login').send({
      email: 'luca.bianchi@example.com', password: generatedPassword,
    }).expect(200);
    expect(login.body).toMatchObject({ role: 'HIKER', mustChangePassword: true });

    const blocked = await hiker.get('/api/bookings').expect(403);
    expect(blocked.body).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });
    expect((await hiker.get('/api/auth/me').expect(200)).body.mustChangePassword).toBe(true);

    await hiker.post('/api/auth/change-password').send({
      currentPassword: generatedPassword, newPassword: 'chosen-password',
    }).expect(204);

    expect((await hiker.get('/api/auth/me').expect(200)).body.mustChangePassword).toBe(false);
    await hiker.get('/api/bookings').expect(200);
  });

  it('creates temporary hikers, searches regular accounts only, and blocks hikers from staff APIs', async () => {
    const employee = await staff();
    await employee.post('/api/staff/hikers').send({
      firstName: 'Luca', lastName: 'Bianchi', email: 'luca.search@example.com',
    }).expect(201);
    const temporary = await employee.post('/api/staff/hikers').send({
      firstName: 'Luca', lastName: 'Temporary', phone: '+39 340 0000000',
    }).expect(201);

    expect(temporary.body).toMatchObject({ firstName: 'Luca', lastName: 'Temporary', email: null, temporary: true });
    const results = await employee.get('/api/staff/hikers').query({ q: 'Bianchi' }).expect(200);
    expect(results.body).toHaveLength(1);
    expect(results.body[0]).toMatchObject({ email: 'luca.search@example.com', temporary: false });

    const hiker = await registeredHiker('reserve.hiker.access@example.com');
    await hiker.get('/api/staff/hikers').query({ q: 'Bianchi' }).expect(403);
  });

  it('previews and books a staff reservation with dietary requirements', async () => {
    const employee = await staff();
    const hiker = await employee.post('/api/staff/hikers').send({
      firstName: 'Temporary', lastName: 'Guest', phone: '+39 340 1111111',
    }).expect(201);
    const slot = await createSlot({ date: '2090-12-15', startsAt: '12:00', endsAt: '13:00', seats: [4, 4] });

    const preview = await employee.get(`/api/staff/slots/${slot.slotId}/seating`)
      .query({ partySize: 3 }).expect(200);
    expect(preview.body).toMatchObject({ slotId: slot.slotId, partySize: 3 });

    const requirements = [{ diets: ['VEGAN'], allergies: ['PEANUTS'] }];
    const booking = await employee.post('/api/staff/bookings').send({
      hikerId: hiker.body.id,
      slotId: slot.slotId,
      partySize: 3,
      tables: preview.body.tables,
      requirements,
    }).expect(201);

    expect(booking.body).toMatchObject({
      slotId: slot.slotId,
      partySize: 3,
      requirements: [{
        diets: ['VEGAN'], otherDiet: null, allergies: ['PEANUTS'], otherAllergy: null,
        otherRequests: null, hasAllergies: true,
      }],
    });
    expect(await get('SELECT party_size AS "partySize" FROM booking WHERE id = $1', [booking.body.id]))
      .toEqual({ partySize: 3 });
    expect(inbox.emails).toEqual([]);
  });

  it('sends the confirmation email to a regular hiker booked by staff', async () => {
    const employee = await staff();
    const hiker = await employee.post('/api/staff/hikers').send({
      firstName: 'Regular', lastName: 'Hiker', email: 'regular.hiker@example.com',
    }).expect(201);
    inbox.clear();
    const slot = await createSlot({ date: '2090-12-16', startsAt: '12:00', endsAt: '13:00', seats: [4] });

    const preview = await employee.get(`/api/staff/slots/${slot.slotId}/seating`)
      .query({ partySize: 2 }).expect(200);
    const booking = await employee.post('/api/staff/bookings').send({
      hikerId: hiker.body.id,
      slotId: slot.slotId,
      partySize: 2,
      tables: preview.body.tables,
    }).expect(201);

    await waitForEmails(1);
    expect(inbox.emails[0]).toMatchObject({
      to: 'regular.hiker@example.com',
      subject: `Your table is booked (QUOTA-${String(booking.body.id).padStart(5, '0')})`,
    });
    expect(inbox.emails[0].text).toContain('Hello Regular Hiker,');
  });
});

describe('Reserve for a Hiker — password reset by email', () => {
  it('sends a link, resets the password once, and does not reveal unknown emails', async () => {
    const employee = await staff();
    await employee.post('/api/staff/hikers').send({
      firstName: 'Reset', lastName: 'Target', email: 'reset.target@example.com',
    }).expect(201);
    inbox.clear();

    await request(app).post('/api/auth/password-reset-requests')
      .send({ email: 'unknown@example.com' }).expect(204);
    expect(inbox.emails).toEqual([]);

    await request(app).post('/api/auth/password-reset-requests')
      .send({ email: 'reset.target@example.com' }).expect(204);
    await waitForEmails(1);
    const link = inbox.emails[0].text.match(/https?:\/\/[^\s]+\/reset-password\?token=([^\s]+)/)?.[1];
    expect(link).toBeTruthy();

    await request(app).post('/api/auth/password-resets').send({
      token: link, newPassword: 'reset-password',
    }).expect(204);
    await request(app).post('/api/auth/password-resets').send({
      token: link, newPassword: 'another-password',
    }).expect(422);

    const hiker = request.agent(app);
    const login = await hiker.post('/api/auth/login').send({
      email: 'reset.target@example.com', password: 'reset-password',
    }).expect(200);
    expect(login.body.mustChangePassword).toBe(false);
  });
});
