import { describe, expect, it } from 'vitest';
import { parseLogin, parseRegister, toUserDto } from '../../src/dto/auth.js';
import { ValidationError } from '../../src/domain/errors.js';

const valid = {
  firstName: ' Ada ',
  lastName: 'Lovelace',
  email: ' Ada@Example.COM ',
  phone: '+39 011 1234567',
  password: 'longenough',
};

describe('parseRegister', () => {
  it('trims and lowercases, and keeps the password as it is', () => {
    expect(parseRegister(valid)).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '+39 011 1234567',
      password: 'longenough',
    });
  });

  it('accepts a missing phone', () => {
    expect(parseRegister({ ...valid, phone: undefined }).phone).toBeNull();
  });

  it.each([
    ['a body that is not an object', null],
    ['an unknown field', { ...valid, role: 'WARDEN' }],
    ['a missing first name', { ...valid, firstName: '  ' }],
    ['a missing last name', { ...valid, lastName: undefined }],
    ['an invalid email', { ...valid, email: 'not-an-email' }],
    ['an invalid phone', { ...valid, phone: 'abc' }],
    ['a short password', { ...valid, password: 'short' }],
  ])('rejects %s', (_name, body) => {
    expect(() => parseRegister(body)).toThrow(ValidationError);
  });
});

describe('parseLogin', () => {
  it('trims and lowercases the email', () => {
    expect(parseLogin({ email: ' A@B.it ', password: 'x' })).toEqual({ email: 'a@b.it', password: 'x' });
  });

  it.each([
    ['a missing password', { email: 'a@b.it' }],
    ['a missing email', { password: 'x' }],
    ['an unknown field', { email: 'a@b.it', password: 'x', extra: 1 }],
    ['a body that is not an object', 'x'],
  ])('rejects %s', (_name, body) => {
    expect(() => parseLogin(body)).toThrow(ValidationError);
  });
});

describe('toUserDto', () => {
  it('exposes only the public fields and null for a missing phone', () => {
    expect(toUserDto({
      id: 1, firstName: 'A', lastName: 'B', email: 'a@b.it', role: 'HIKER', passwordHash: 'secret',
    })).toEqual({ id: 1, firstName: 'A', lastName: 'B', email: 'a@b.it', phone: null, role: 'HIKER' });
  });
});
