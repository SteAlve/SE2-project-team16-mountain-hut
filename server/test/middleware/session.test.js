import { describe, expect, it, vi } from 'vitest';
import { makeReadSessionCookie, makeRequireAuth } from '../../src/middleware/session.js';

const read = (cookie) => {
  const req = { headers: { cookie } };
  makeReadSessionCookie('sid')(req, {}, () => {});
  return req.sessionId;
};

describe('makeReadSessionCookie', () => {
  it('finds the cookie among others', () => {
    expect(read('a=1; sid=abc; b=2')).toBe('abc');
    expect(read('sid=x=y')).toBe('x=y');
  });

  it('gives undefined when absent, empty or not exact', () => {
    expect(read(undefined)).toBeUndefined();
    expect(read('other=1')).toBeUndefined();
    expect(read('sid=')).toBeUndefined();
    expect(read('xsid=abc')).toBeUndefined();
  });
});

describe('makeRequireAuth', () => {
  it('puts the user in req.user', async () => {
    const req = { sessionId: 's' };
    const next = vi.fn();
    await makeRequireAuth(async (id) => ({ id, name: 'u' }))(req, {}, next);
    expect(req.user).toEqual({ id: 's', name: 'u' });
    expect(next).toHaveBeenCalledWith();
  });

  it('passes the error to next', async () => {
    const err = new Error('no');
    const next = vi.fn();
    await makeRequireAuth(async () => { throw err; })({}, {}, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
