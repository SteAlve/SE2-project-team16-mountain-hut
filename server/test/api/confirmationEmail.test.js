// MH-03 Receive confirmation: the whole path of the email, from POST /api/bookings to an SMTP
// server. Only the email service is replaced, by the one of test/helpers/smtpInbox.js: the app,
// the database and nodemailer are the real ones.
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { startSmtpInbox } from '../helpers/smtpInbox.js';

const inbox = await startSmtpInbox();

// config.js reads these when it is first imported, so they are set before any file of src/ is
// imported: those imports come after, not at the top. The user is emptied so a personal
// server/.env cannot add a login.
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

async function hiker(email, { firstName = 'Mara', lastName = 'Rossi' } = {}) {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ firstName, lastName, email, password: PASSWORD }).expect(201);
  return agent;
}

// Books the tables that the preview proposes, as the client does.
async function book(agent, slot, partySize) {
  const { tables } = (await request(app).get(`/api/slots/${slot.slotId}/seating`).query({ partySize }).expect(200)).body;
  return agent.post('/api/bookings').send({ slotId: slot.slotId, partySize, tables });
}

const reference = (bookingId) => `QUOTA-${String(bookingId).padStart(5, '0')}`;

describe('the confirmation email of a booking', () => {
  it('reaches the hiker who booked, with the details of the booking', async () => {
    const slot = await createSlot({ date: '2090-11-04', startsAt: '12:30', endsAt: '14:00', seats: [4, 2] });
    const agent = await hiker('mara.rossi@example.com');

    const res = await book(agent, slot, 5);

    expect(res.status).toBe(201);
    expect(inbox.emails).toHaveLength(1);
    const [email] = inbox.emails;
    expect(email.envelope).toEqual({ from: 'no-reply@quota.example', to: ['mara.rossi@example.com'] });
    expect(email.from).toEqual({ name: 'QUOTA', address: 'no-reply@quota.example' });
    expect(email.to).toBe('mara.rossi@example.com');
    expect(email.subject).toBe(`Your table is booked (${reference(res.body.id)})`);
    for (const line of [
      'Hello Mara Rossi,',
      `Booking reference: ${reference(res.body.id)}`,
      'Name: Mara Rossi',
      'Date: 4 November 2090',
      'Time: 12:30–14:00',
      'Party size: 5',
    ]) {
      expect(email.text).toContain(line);
    }
  });

  it('has an HTML version with the same details', async () => {
    const slot = await createSlot({ date: '2090-11-05', startsAt: '19:00', endsAt: '20:30' });
    const agent = await hiker('html.version@example.com');

    const res = await book(agent, slot, 2);

    const { html } = inbox.emails[0];
    expect(html).toContain('<meta charset="utf-8">');
    for (const value of [reference(res.body.id), 'Mara Rossi', '5 November 2090', '19:00–20:30']) {
      expect(html).toContain(value);
    }
  });

  it('does not say the table numbers, also when the party is split over tables (PO, issue #24)', async () => {
    const slot = await createSlot({ seats: [2, 2, 2] });
    const agent = await hiker('no.tables@example.com');

    const res = await book(agent, slot, 6);

    expect(res.body.tables).toHaveLength(3);
    const { text, html } = inbox.emails[0];
    expect(text).not.toMatch(/table\s*(number|n\.|#)?\s*\d/i);
    expect(html).not.toMatch(/table\s*(number|n\.|#)?\s*\d/i);
  });

  it('writes a name typed with HTML characters as text, not as HTML', async () => {
    const slot = await createSlot();
    const agent = await hiker('html.name@example.com', { firstName: '<b>Mara</b>', lastName: 'O\'Neil & Co' });

    await book(agent, slot, 1);

    const { text, html } = inbox.emails[0];
    expect(text).toContain("Hello <b>Mara</b> O'Neil & Co,");
    expect(html).not.toContain('<b>Mara</b>');
    expect(html).toContain('&lt;b&gt;Mara&lt;/b&gt; O&#39;Neil &amp; Co');
  });

  it('goes to each hiker for their own booking, with its own reference', async () => {
    const slot = await createSlot({ seats: [4, 4] });
    const first = await book(await hiker('first.hiker@example.com'), slot, 2);
    const second = await book(await hiker('second.hiker@example.com', { firstName: 'Luca' }), slot, 3);

    expect(inbox.emails.map(({ to, subject }) => ({ to, subject }))).toEqual([
      { to: 'first.hiker@example.com', subject: `Your table is booked (${reference(first.body.id)})` },
      { to: 'second.hiker@example.com', subject: `Your table is booked (${reference(second.body.id)})` },
    ]);
    expect(inbox.emails[1].text).toContain('Hello Luca Rossi,');
  });

  it('is not sent when the booking fails', async () => {
    const slot = await createSlot({ seats: [2] });
    const agent = await hiker('refused.booking@example.com');

    const notLoggedIn = await request(app).post('/api/bookings')
      .send({ slotId: slot.slotId, partySize: 1, tables: [{ tableNumber: 1, seats: 1 }] });
    const tooBig = await agent.post('/api/bookings')
      .send({ slotId: slot.slotId, partySize: 3, tables: [{ tableNumber: 1, seats: 3 }] });
    const unknownSlot = await agent.post('/api/bookings')
      .send({ slotId: 999999999, partySize: 1, tables: [{ tableNumber: 1, seats: 1 }] });

    expect([notLoggedIn.status, tooBig.status, unknownSlot.status]).toEqual([401, 409, 404]);
    expect(inbox.emails).toEqual([]);
  });

  it('when the email service refuses it, the booking still stands and the hiker gets 201', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    inbox.refuse = true;
    const slot = await createSlot({ seats: [4] });
    const agent = await hiker('mail.refused@example.com');

    const res = await book(agent, slot, 2);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ slotId: slot.slotId, partySize: 2 });
    expect(await get('SELECT party_size AS "partySize" FROM booking WHERE id = $1', [res.body.id]))
      .toEqual({ partySize: 2 });
    expect(inbox.emails).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      `The confirmation email of booking ${res.body.id} was not sent:`,
      expect.objectContaining({ responseCode: 550 }),
    );
  });
});
