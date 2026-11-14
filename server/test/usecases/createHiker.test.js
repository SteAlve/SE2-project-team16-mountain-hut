import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeCreateHiker } from '../../src/usecases/createHiker.js';
import { ConflictError, ForbiddenError } from '../../src/domain/errors.js';

const employee = { id: 1, role: 'EMPLOYEE' };
const hiker = { id: 2, role: 'HIKER' };
const createdAccount = {
  id: 8, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '+39 333 1234567', temporary: false,
};

function setup({ account = createdAccount } = {}) {
  const users = {
    insert: vi.fn().mockResolvedValue(account),
    insertTemporaryHiker: vi.fn().mockResolvedValue({
      id: 9, firstName: 'Temporary', lastName: 'Hiker', email: null, phone: null, temporary: true,
    }),
  };
  const passwordHasher = { hash: vi.fn().mockResolvedValue('hashed-generated') };
  const passwordGenerator = { generate: vi.fn().mockReturnValue('generated-password') };
  const mailer = { send: vi.fn().mockResolvedValue(undefined) };
  return {
    users, passwordHasher, passwordGenerator, mailer,
    create: makeCreateHiker({ users, passwordHasher, passwordGenerator, mailer, appUrl: 'https://quota.example' }),
  };
}

afterEach(() => vi.restoreAllMocks());

describe('createHiker use case', () => {
  it('creates a regular hiker with a generated password and emails it', async () => {
    const t = setup();

    const result = await t.create({
      user: employee, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '+39 333 1234567',
    });

    expect(t.passwordGenerator.generate).toHaveBeenCalledExactlyOnceWith();
    expect(t.passwordHasher.hash).toHaveBeenCalledExactlyOnceWith('generated-password');
    expect(t.users.insert).toHaveBeenCalledExactlyOnceWith({
      firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '+39 333 1234567',
      role: 'HIKER', passwordHash: 'hashed-generated', mustChangePassword: true,
    });
    expect(t.mailer.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      to: 'ada@example.com', subject: 'Your QUOTA account', text: expect.stringContaining('Password: generated-password'),
    }));
    expect(result).toEqual(createdAccount);
  });

  it('creates a temporary hiker without generating a password or sending email', async () => {
    const t = setup();

    const result = await t.create({ user: employee, firstName: 'Temporary', lastName: 'Hiker', email: null, phone: null });

    expect(t.users.insertTemporaryHiker).toHaveBeenCalledExactlyOnceWith({
      firstName: 'Temporary', lastName: 'Hiker', phone: null,
    });
    expect(t.users.insert).not.toHaveBeenCalled();
    expect(t.passwordGenerator.generate).not.toHaveBeenCalled();
    expect(t.passwordHasher.hash).not.toHaveBeenCalled();
    expect(t.mailer.send).not.toHaveBeenCalled();
    expect(result.temporary).toBe(true);
  });

  it('allows the warden and refuses a hiker before writing', async () => {
    const t = setup();

    await expect(t.create({ user: hiker, firstName: 'A', lastName: 'B', email: null, phone: null }))
      .rejects.toThrow(new ForbiddenError('Only the staff can do this'));
    expect(t.users.insert).not.toHaveBeenCalled();
    expect(t.users.insertTemporaryHiker).not.toHaveBeenCalled();
  });

  it('answers a conflict when the regular account email already exists', async () => {
    const t = setup({ account: null });

    await expect(t.create({ user: employee, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: null }))
      .rejects.toThrow(new ConflictError('An account with this email already exists'));
    expect(t.mailer.send).not.toHaveBeenCalled();
  });

  it('keeps the account when sending its email fails', async () => {
    const t = setup();
    const error = new Error('SMTP unavailable');
    t.mailer.send.mockRejectedValue(error);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(t.create({ user: employee, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: null }))
      .resolves.toEqual(createdAccount);

    expect(log).toHaveBeenCalledExactlyOnceWith('The account email of hiker 8 was not sent:', error);
  });
});
