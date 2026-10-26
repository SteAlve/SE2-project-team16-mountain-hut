/**
 * API TESTS: here go the tests of the endpoints, named *.test.js: Supertest on `app`, which also
 * covers routes/ and controllers/. Replace the dao modules the endpoint uses with vi.mock, so the
 * test needs no database.
 *
 * THE CODE BELOW IS JUST AN EXAMPLE (story MH-01).
 * Delete this file when the first real one exists.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('POST /api/bookings', () => {
  it('answers 400 when partySize is missing', async () => {
    const response = await request(app).post('/api/bookings').send({ slotId: 3 });

    expect(response.status).toBe(400);
  });
});
