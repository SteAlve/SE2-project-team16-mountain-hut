import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('API app errors', () => {
  // Any /api path that no router answers returns 404 with the usual error body.
  it('answers 404 for an unknown path under /api', async () => {
    const response = await request(app).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'NotFoundError', message: 'Resource not found' });
  });

  // Malformed JSON is rejected by Express, and answered like any other validation error.
  it('answers 400 for malformed JSON', async () => {
    const response = await request(app)
      .post('/api/does-not-exist')
      .set('Content-Type', 'application/json')
      .send('{"slotId":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'ValidationError',
      message: 'Request body must be valid JSON',
    });
  });
});
