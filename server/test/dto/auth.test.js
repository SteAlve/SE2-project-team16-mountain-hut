import { describe, expect, it } from 'vitest';
import {
  parseChangePassword,
  parseForgotPassword,
  parseLogin,
  parseRegister,
  parseResetPassword,
  toUserDto,
} from '../../src/dto/auth.js';
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

describe('parseChangePassword', () => {
  it('keeps the current password and validates the new one', () => {
    expect(parseChangePassword({ currentPassword: 'generated', newPassword: 'new-password' }))
      .toEqual({ currentPassword: 'generated', newPassword: 'new-password' });
  });

  it.each([
    ['a missing current password', { newPassword: 'new-password' }, 'currentPassword is required'],
    ['a short new password', { currentPassword: 'current', newPassword: 'short' }, 'newPassword must have at least 8 characters'],
    ['an unknown field', { currentPassword: 'current', newPassword: 'new-password', token: 'x' }, 'Unknown field: token'],
  ])('rejects %s', (_name, body, message) => {
    expect(() => parseChangePassword(body)).toThrow(new ValidationError(message));
  });
});

describe('password reset DTOs', () => {
  it('normalizes the email used to request a reset link', () => {
    expect(parseForgotPassword({ email: ' Ada@Example.COM ' })).toEqual({ email: 'ada@example.com' });
  });

  it('accepts the token and new password used to complete a reset', () => {
    expect(parseResetPassword({ token: 'token-id', newPassword: 'new-password' }))
      .toEqual({ token: 'token-id', newPassword: 'new-password' });
  });

  it.each([
    ['a missing email', {}, 'email is required'],
    ['an invalid email', { email: 'not-an-email' }, 'email must be a valid email'],
  ])('rejects %s', (_name, body, message) => {
    expect(() => parseForgotPassword(body)).toThrow(new ValidationError(message));
  });

  it.each([
    ['a missing token', { newPassword: 'new-password' }, 'token is required'],
    ['a short reset password', { token: 'token-id', newPassword: 'short' }, 'newPassword must have at least 8 characters'],
  ])('rejects %s', (_name, body, message) => {
    expect(() => parseResetPassword(body)).toThrow(new ValidationError(message));
  });
});

describe('toUserDto', () => {
  it('exposes only the public fields and null for a missing phone', () => {
    expect(toUserDto({
      id: 1, firstName: 'A', lastName: 'B', email: 'a@b.it', role: 'HIKER', passwordHash: 'secret', mustChangePassword: true,
    })).toEqual({ id: 1, firstName: 'A', lastName: 'B', email: 'a@b.it', phone: null, role: 'HIKER', mustChangePassword: true });
  });
});
