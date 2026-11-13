// MH-06 email delivery: the API, database, change use case, nodemailer and SMTP are real; only the
// external email service is replaced by the local inbox helper.
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { startSmtpInbox } from '../helpers/smtpInbox.js';

const inbox = await startSmtpInbox();
Object.assign(process.env, {
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: String(inbox.port),
  SMTP_USER: '',
  SMTP_PASSWORD: '',
  MAIL_FROM: 'QUOTA <no-reply@quota.example>',
});
const { app } = await import('../../src/app.js');
const { close, get, run } = await import('../../src/dao/db.js');
const { cleanBookingData, createSlot } = await import('../helpers/bookingFixtures.js');

const PASSWORD = 'password123';
const clean = async () => {
  await cleanBookingData();
  await run("DELETE FROM app_user WHERE email LIKE '%@example.com'");
};
const reference = (bookingId) => `QUOTA-${String(bookingId).padStart(5, '0')}`;

beforeEach(async () => {
  await clean();
  inbox.clear();
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await clean();
  await close();
  await inbox.stop();
});

async function hiker(email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/register')
    .send({ firstName: 'Mara', lastName: 'Rossi', email, password: PASSWORD })
    .expect(201);
  return agent;
}

async function book(agent, slot, partySize) {
  const { tables } = (await request(app).get(`/api/slots/${slot.slotId}/seating`)
    .query({ partySize }).expect(200)).body;
  return agent.post('/api/bookings').send({ slotId: slot.slotId, partySize, tables });
}

describe('MH-06 change email delivery', () => {
  it('sends the hiker the same booking reference with the saved new date, time, party and needs', async () => {
    const original = await createSlot({ date: '2090-11-04', startsAt: '12:30', endsAt: '14:00', seats: [4, 4] });
    const destination = await createSlot({ date: '2090-11-06', startsAt: '18:00', endsAt: '19:30', seats: [4, 4] });
    const agent = await hiker('changed.booking@example.com');
    const created = await book(agent, original, 2);
    expect(created.status).toBe(201);
    inbox.clear();

    const changed = await agent.patch(`/api/bookings/${created.body.id}`).send({
      slotId: destination.slotId,
      partySize: 3,
      requirements: [{ diets: ['VEGAN'], allergies: ['PEANUTS'] }],
    });

    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({
      id: created.body.id,
      date: destination.date,
      startsAt: '18:00',
      endsAt: '19:30',
      partySize: 3,
      requirements: [{ diets: ['VEGAN'], allergies: ['PEANUTS'], hasAllergies: true }],
    });
    expect(inbox.emails).toHaveLength(1);
    const [email] = inbox.emails;
    expect(email.envelope).toEqual({ from: 'no-reply@quota.example', to: ['changed.booking@example.com'] });
    expect(email.to).toBe('changed.booking@example.com');
    expect(email.subject).toBe(`Your booking has changed (${reference(created.body.id)})`);
    for (const detail of [
      'Hello Mara Rossi,',
      `Booking reference: ${reference(created.body.id)}`,
      'Name: Mara Rossi',
      'Date: 6 November 2090',
      'Time: 18:00–19:30',
      'Party size: 3',
      'Dietary needs:',
      '- 1 guest: Allergies: Peanuts · Diet: Vegan',
      'These details replace the ones of the earlier emails',
    ]) {
      expect(email.text).toContain(detail);
    }
    expect(email.html).toContain(reference(created.body.id));
    expect(email.html).toContain('6 November 2090');
    expect(email.html).toContain('18:00–19:30');
    expect(email.html).toContain('Party size');
  });

  it('sends no change email when the booking change is rejected', async () => {
    const slot = await createSlot({ seats: [2] });
    const agent = await hiker('rejected.change@example.com');
    const created = await book(agent, slot, 2);
    expect(created.status).toBe(201);
    inbox.clear();

    const rejected = await agent.patch(`/api/bookings/${created.body.id}`).send({ partySize: 3 });

    expect(rejected.status).toBe(409);
    expect(rejected.body.code).toBe('NO_SEATS');
    expect(inbox.emails).toEqual([]);
    expect(await get('SELECT party_size AS "partySize" FROM booking WHERE id = $1', [created.body.id]))
      .toEqual({ partySize: 2 });
  });

  it('keeps the successful change when SMTP refuses the notification', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const slot = await createSlot({ seats: [4] });
    const agent = await hiker('failed.change.email@example.com');
    const created = await book(agent, slot, 2);
    expect(created.status).toBe(201);
    inbox.clear();
    inbox.refuse = true;

    const changed = await agent.patch(`/api/bookings/${created.body.id}`).send({ partySize: 3 });

    expect(changed.status).toBe(200);
    expect(changed.body.partySize).toBe(3);
    expect(inbox.emails).toEqual([]);
    expect(await get('SELECT party_size AS "partySize" FROM booking WHERE id = $1', [created.body.id]))
      .toEqual({ partySize: 3 });
    expect(error).toHaveBeenCalledWith(
      `The email about the change of booking ${created.body.id} was not sent:`,
      expect.objectContaining({ responseCode: 550 }),
    );
  });
});
