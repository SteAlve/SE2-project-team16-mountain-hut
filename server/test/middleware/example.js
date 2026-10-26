/**
 * MIDDLEWARE TESTS: here go the tests of the code that runs before the controllers, named
 * *.test.js. Call the middleware with a fake request: no database, no HTTP server.
 *
 * THE CODE BELOW IS JUST AN EXAMPLE (story MH-01).
 * Delete this file when the first real one exists.
 */
import { describe, it, expect } from 'vitest';
import { makeRequireAuth } from '../../src/middleware/requireAuth.js';

describe('requireAuth (middleware)', () => {
  it('puts the logged-in user in req.user', async () => {
    const requireAuth = makeRequireAuth(async () => ({ id: 1, role: 'hiker' }));
    const req = { headers: { cookie: 'sid=good' } };

    await requireAuth(req, {}, () => {});

    expect(req.user).toEqual({ id: 1, role: 'hiker' });
  });
});
