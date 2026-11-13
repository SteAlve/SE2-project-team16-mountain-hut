// MH-05 Provide party requirements: the whole path of POST /api/bookings with the dietary needs of
// the guests, from the HTTP request to the database and to the confirmation email. Only the email
// service is replaced, by the SMTP server of test/helpers/smtpInbox.js (as in confirmationEmail.test.js).
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { startSmtpInbox } from '../helpers/smtpInbox.js';

const inbox = await startSmtpInbox();

// config.js reads these when it is first imported: they are set before any file of src/ is imported.
Object.assign(process.env, {
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: String(inbox.port),
  SMTP_USER: '',
  SMTP_PASSWORD: '',
  MAIL_FROM: 'QUOTA <no-reply@quota.example>',
});
const { app } = await import('../../src/app.js');
const { all, close, get, run } = await import('../../src/dao/db.js');
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
afterAll(async () => {
  await clean();
  await close();
  await inbox.stop();
});

async function hiker(email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ firstName: 'Mara', lastName: 'Rossi', email, password: PASSWORD }).expect(201);
  return agent;
}

const previewOf = async (slot, partySize) =>
  (await request(app).get(`/api/slots/${slot.slotId}/seating`).query({ partySize }).expect(200)).body.tables;

// Books the tables of the preview, with the requirements, as the client does.
async function book(agent, slot, partySize, requirements) {
  const tables = await previewOf(slot, partySize);
  const body = { slotId: slot.slotId, partySize, tables };
  if (requirements !== undefined) body.requirements = requirements;
  return agent.post('/api/bookings').send(body);
}

const saved = (fields) => ({
  diets: [], otherDiet: null, allergies: [], otherAllergy: null, otherRequests: null, hasAllergies: false, ...fields,
});
const bookingCount = async (slot) =>
  (await get('SELECT COUNT(*)::INT AS n FROM booking WHERE slot_id = $1', [slot.slotId])).n;
const needsCount = async (slot) => (await get(
  'SELECT COUNT(*)::INT AS n FROM booking_requirement WHERE booking_id IN (SELECT id FROM booking WHERE slot_id = $1)',
  [slot.slotId],
)).n;
const freeSeats = async (slot) =>
  (await request(app).get('/api/slots')).body.find((s) => s.slotId === slot.slotId).freeSeats;

describe('POST /api/bookings with dietary needs (MH-05)', () => {
  it('saves and answers the example of the story: three lines for three subsets of the party', async () => {
    const slot = await createSlot({ seats: [4, 2] });
    const agent = await hiker('needs.story@example.com');

    const res = await book(agent, slot, 6, [
      { diets: ['VEGAN'], allergies: ['PEANUTS'] },
      { allergies: ['SHELLFISH'], otherRequests: 'No mushrooms, please' },
      { diets: ['VEGETARIAN', 'LACTOSE_FREE'] },
    ]);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      date: slot.date,
      slotId: slot.slotId,
      partySize: 6,
      tables: [{ tableNumber: 1, seats: 4 }, { tableNumber: 2, seats: 2 }],
      requirements: [
        saved({ diets: ['VEGAN'], allergies: ['PEANUTS'], hasAllergies: true }),
        saved({ allergies: ['SHELLFISH'], otherRequests: 'No mushrooms, please', hasAllergies: true }),
        saved({ diets: ['VEGETARIAN', 'LACTOSE_FREE'], hasAllergies: false }),
      ],
    });
  });

  it('saves the lines with the booking, in the same order', async () => {
    const slot = await createSlot({ seats: [6] });
    const agent = await hiker('needs.saved@example.com');

    const res = await book(agent, slot, 3, [
      { otherRequests: 'First' },
      { diets: ['PESCATARIAN'] },
      { otherAllergy: 'Kiwi' },
    ]);

    const rows = await all(
      `SELECT diets, other_diet AS "otherDiet", allergies, other_allergy AS "otherAllergy",
              other_requests AS "otherRequests", has_allergies AS "hasAllergies"
       FROM booking_requirement WHERE booking_id = $1 ORDER BY id`,
      [res.body.id],
    );
    expect(rows).toEqual([
      saved({ otherRequests: 'First' }),
      saved({ diets: ['PESCATARIAN'] }),
      saved({ otherAllergy: 'Kiwi', hasAllergies: true }),
    ]);
  });

  it('checks the allergies flag for a preset allergy and for an allergy written in words, and only then', async () => {
    const slot = await createSlot({ seats: [6] });
    const agent = await hiker('needs.flag@example.com');

    const res = await book(agent, slot, 4, [
      { allergies: ['GLUTEN'] },
      { otherAllergy: 'Kiwi' },
      { diets: ['VEGAN'], otherDiet: 'Raw', otherRequests: 'Allergic to nothing' },
      { otherRequests: 'Window seat' },
    ]);

    expect(res.body.requirements.map((item) => item.hasAllergies)).toEqual([true, true, false, false]);
  });

  it('trims the texts that the hiker typed', async () => {
    const slot = await createSlot({ seats: [4] });
    const agent = await hiker('needs.trim@example.com');

    const res = await book(agent, slot, 1, [{ otherDiet: '  Halal ', otherRequests: ' No onion\n' }]);

    expect(res.status).toBe(201);
    expect(res.body.requirements).toEqual([saved({ otherDiet: 'Halal', otherRequests: 'No onion' })]);
  });

  it('accepts as many lines as people', async () => {
    const slot = await createSlot({ seats: [4] });
    const agent = await hiker('needs.each@example.com');

    const res = await book(agent, slot, 4, Array.from({ length: 4 }, () => ({ diets: ['VEGETARIAN'] })));

    expect(res.status).toBe(201);
    expect(res.body.requirements).toHaveLength(4);
  });

  it('has an empty list when the requirements are not sent or are an empty list (the booking of MH-01)', async () => {
    const slot = await createSlot({ seats: [6] });
    const first = await book(await hiker('needs.none1@example.com'), slot, 1);
    const second = await book(await hiker('needs.none2@example.com'), slot, 1, []);

    expect(first.status).toBe(201);
    expect(first.body.requirements).toEqual([]);
    expect(second.status).toBe(201);
    expect(second.body.requirements).toEqual([]);
  });

  it('does not change where the party sits, nor the seats left, whatever the needs', async () => {
    const slot = await createSlot({ seats: [4, 4] });
    const agent = await hiker('needs.seats@example.com');
    const proposed = await previewOf(slot, 3);

    const res = await book(agent, slot, 3, [{ diets: ['VEGAN'] }, { allergies: ['EGGS'] }]);

    expect(res.body.tables).toEqual(proposed);
    expect(await freeSeats(slot)).toBe(5);
  });

  it('keeps the needs of each hiker with their own booking', async () => {
    const slot = await createSlot({ seats: [4, 4] });
    const first = await book(await hiker('needs.own1@example.com'), slot, 2, [{ diets: ['VEGAN'] }]);
    const second = await book(await hiker('needs.own2@example.com'), slot, 2, [{ allergies: ['FISH'] }, { otherRequests: 'Quiet' }]);

    const count = async (id) => (await get('SELECT COUNT(*)::INT AS n FROM booking_requirement WHERE booking_id = $1', [id])).n;
    expect(first.body.requirements).toEqual([saved({ diets: ['VEGAN'] })]);
    expect(second.body.requirements).toHaveLength(2);
    expect(await count(first.body.id)).toBe(1);
    expect(await count(second.body.id)).toBe(2);
  });

  it('accepts the longest texts allowed and refuses one more character', async () => {
    const slot = await createSlot({ seats: [4] });
    const agent = await hiker('needs.long@example.com');

    const tooLong = await book(agent, slot, 1, [{ otherRequests: 'r'.repeat(301) }]);
    expect(tooLong.status).toBe(400);
    expect(await bookingCount(slot)).toBe(0);

    const longest = await book(agent, slot, 1, [{ otherDiet: 'd'.repeat(100), otherAllergy: 'a'.repeat(100), otherRequests: 'r'.repeat(300) }]);
    expect(longest.status).toBe(201);
    expect(longest.body.requirements[0].otherRequests).toHaveLength(300);
  });
});

describe('POST /api/bookings: wrong dietary needs answer 400 and book nothing (MH-05)', () => {
  const T = (tableNumber, seats) => ({ tableNumber, seats });

  it.each([
    ['requirements that are not a list', { diets: ['VEGAN'] }, 'requirements must be an array'],
    ['a line that is not an object', ['vegan'], 'Each requirement must be an object'],
    ['a field that is not allowed in a line', [{ diets: ['VEGAN'], guests: 2 }], 'Unknown field in requirements: guests'],
    ['the flag sent by the client: the server works it out', [{ allergies: ['EGGS'], hasAllergies: false }], 'Unknown field in requirements: hasAllergies'],
    ['diets that are not a list', [{ diets: 'VEGAN' }], 'diets must be an array of text'],
    ['the same allergy twice', [{ allergies: ['EGGS', 'EGGS'] }], 'The same value can appear only once in allergies'],
    ['an empty line', [{}], 'Each requirement needs a diet, an allergy or a request'],
    ['a blank text', [{ otherRequests: '   ' }], 'otherRequests cannot be empty'],
    ['an other diet over 100 characters', [{ otherDiet: 'x'.repeat(101) }], 'otherDiet can be at most 100 characters'],
    ['a diet that is not in the list', [{ diets: ['KETO'] }], 'diets can contain only VEGETARIAN, VEGAN, PESCATARIAN, LACTOSE_FREE'],
    ['a diet in lowercase', [{ diets: ['vegan'] }], 'diets can contain only VEGETARIAN, VEGAN, PESCATARIAN, LACTOSE_FREE'],
    ['an allergy that is not in the list', [{ allergies: ['KIWI'] }], 'allergies can contain only GLUTEN, MILK, EGGS, PEANUTS, TREE_NUTS, FISH, SHELLFISH'],
    ['two diets that exclude each other', [{ diets: ['VEGAN', 'VEGETARIAN'] }], 'A guest can follow only one of VEGETARIAN, VEGAN, PESCATARIAN'],
    ['more lines than people', [{ diets: ['VEGAN'] }, { diets: ['VEGAN'] }, { diets: ['VEGAN'] }], 'There can be at most one requirement per person of the party'],
  ])('refuses %s', async (_name, requirements, message) => {
    const slot = await createSlot({ seats: [4] });
    const agent = await hiker('needs.bad@example.com');

    const res = await agent.post('/api/bookings').send({ slotId: slot.slotId, partySize: 2, tables: [T(1, 2)], requirements });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'ValidationError', message });
    expect(await bookingCount(slot)).toBe(0);
    expect(await freeSeats(slot)).toBe(4);
    expect(inbox.emails).toEqual([]);
  });

  it('refuses one wrong line among good ones, and saves none of them', async () => {
    const slot = await createSlot({ seats: [4] });
    const agent = await hiker('needs.onebad@example.com');

    const res = await agent.post('/api/bookings').send({
      slotId: slot.slotId,
      partySize: 3,
      tables: [T(1, 3)],
      requirements: [{ diets: ['VEGAN'] }, { allergies: ['EGGS'] }, { diets: ['KETO'] }],
    });

    expect(res.status).toBe(400);
    expect(await needsCount(slot)).toBe(0);
  });

  it('lets the same hiker book again with good needs after a refusal', async () => {
    const slot = await createSlot({ seats: [4] });
    const agent = await hiker('needs.retry@example.com');

    expect((await book(agent, slot, 2, [{ diets: ['KETO'] }])).status).toBe(400);
    const again = await book(agent, slot, 2, [{ diets: ['VEGAN'] }]);

    expect(again.status).toBe(201);
    expect(await bookingCount(slot)).toBe(1);
  });

  it('keeps the other answers of the booking: 401 without a login, 409 and 422 as before', async () => {
    const slot = await createSlot({ seats: [2] });
    const needs = [{ diets: ['VEGAN'] }];

    const anonymous = await request(app).post('/api/bookings')
      .send({ slotId: slot.slotId, partySize: 1, tables: [T(1, 1)], requirements: needs });
    expect(anonymous.status).toBe(401);

    const agent = await hiker('needs.rules@example.com');
    const wrongTables = await agent.post('/api/bookings')
      .send({ slotId: slot.slotId, partySize: 1, tables: [T(9, 1)], requirements: needs });
    expect(wrongTables.status).toBe(409);
    expect(wrongTables.body.code).toBe('TABLES_CHANGED');

    expect((await book(agent, slot, 1, needs)).status).toBe(201);
    const again = await book(agent, slot, 1, needs);
    expect(again.status).toBe(422);
    expect(again.body.message).toBe('You already have a booking for this slot');
    expect(await needsCount(slot)).toBe(1);
  });

  it('saves no needs when the booking is refused for lack of seats', async () => {
    const slot = await createSlot({ seats: [2] });
    await book(await hiker('needs.full1@example.com'), slot, 2);

    const res = await (await hiker('needs.full2@example.com')).post('/api/bookings')
      .send({ slotId: slot.slotId, partySize: 2, tables: [T(1, 2)], requirements: [{ diets: ['VEGAN'] }] });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NO_SEATS');
    expect(await needsCount(slot)).toBe(0);
  });
});

describe('the confirmation email carries the dietary needs (MH-05)', () => {
  it('lists the needs of the guests after the details of the booking', async () => {
    const slot = await createSlot({ seats: [4, 2] });
    const agent = await hiker('needs.email@example.com');

    const res = await book(agent, slot, 6, [
      { diets: ['VEGAN'], allergies: ['PEANUTS'] },
      { allergies: ['SHELLFISH'] },
      { diets: ['VEGETARIAN'] },
      { diets: ['VEGETARIAN'] },
    ]);

    expect(res.status).toBe(201);
    expect(inbox.emails).toHaveLength(1);
    const { text, html } = inbox.emails[0];
    expect(text).toContain([
      'Dietary needs:',
      '- 1 guest: Allergies: Peanuts · Diet: Vegan',
      '- 1 guest: Allergies: Shellfish',
      '- 2 guests: Diet: Vegetarian',
    ].join('\n'));
    expect(text.indexOf('Dietary needs:')).toBeGreaterThan(text.indexOf('Party size: 6'));
    expect(html).toContain('Dietary needs');
    expect(html).toContain('Allergies: Peanuts');
    expect(html).toContain('2 guests');
  });

  it('writes what the hiker typed as text in the HTML version', async () => {
    const slot = await createSlot({ seats: [4] });
    const agent = await hiker('needs.html@example.com');

    await book(agent, slot, 1, [{ otherRequests: '<b>No</b> onion & garlic' }]);

    const { text, html } = inbox.emails[0];
    expect(text).toContain('"<b>No</b> onion & garlic"');
    expect(html).not.toContain('<b>No</b>');
    expect(html).toContain('&lt;b&gt;No&lt;/b&gt; onion &amp; garlic');
  });

  it('has no section about needs when the hiker gave none', async () => {
    const slot = await createSlot({ seats: [4] });
    const agent = await hiker('needs.email.none@example.com');

    await book(agent, slot, 2);

    const { text, html } = inbox.emails[0];
    expect(text).not.toContain('Dietary needs');
    expect(html).not.toContain('Dietary needs');
  });

  it('is not sent when the needs are wrong', async () => {
    const slot = await createSlot({ seats: [4] });
    const agent = await hiker('needs.email.bad@example.com');

    const res = await book(agent, slot, 1, [{ allergies: ['KIWI'] }]);

    expect(res.status).toBe(400);
    expect(inbox.emails).toEqual([]);
  });

  it('is sent with the needs even if the hiker only wrote requests for the kitchen', async () => {
    const slot = await createSlot({ seats: [4] });
    const agent = await hiker('needs.email.request@example.com');

    await book(agent, slot, 1, [{ otherRequests: 'High chair' }]);

    expect(inbox.emails[0].text).toContain('- 1 guest: "High chair"');
  });
});
