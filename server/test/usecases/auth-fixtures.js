export const NOW = new Date('2026-01-01T12:00:00Z');

export const input = {
  firstName: 'A',
  lastName: 'B',
  email: 'a@b.it',
  phone: null,
  password: 'password1',
};

export function setup() {
  const rows = [];
  const stored = [];
  const calls = {
    passwordHash: [],
    passwordVerify: [],
    tokenHash: [],
    tokenGenerate: 0,
    sessionInsert: [],
    sessionRemove: [],
    expiredRemoval: [],
  };
  const clock = {
    now: () => NOW,
    after: (ms) => new Date(NOW.getTime() + ms),
  };
  const tokens = {
    generate: () => {
      calls.tokenGenerate += 1;
      const id = `id-${calls.tokenGenerate}`;
      return { id, hash: `hash-${id}` };
    },
    hash: (id) => {
      calls.tokenHash.push(id);
      return `hash-${id}`;
    },
  };
  const passwordHasher = {
    hash: async (password) => {
      calls.passwordHash.push(password);
      return `h(${password})`;
    },
    verify: async (password, passwordHash) => {
      calls.passwordVerify.push({ password, passwordHash });
      return passwordHash === `h(${password})`;
    },
  };
  const users = {
    findByEmail: async (email) => rows.find((user) => user.email === email) ?? null,
    insert: async (data) => {
      if (rows.some((user) => user.email === data.email)) return null;
      const user = { id: rows.length + 1, ...data };
      rows.push(user);
      return user;
    },
  };
  const sessions = {
    insert: async (session) => {
      calls.sessionInsert.push(session);
      stored.push(session);
    },
    findByTokenHash: async (tokenHash) => {
      const session = stored.find((item) => item.tokenHash === tokenHash);
      const user = session && rows.find((row) => row.id === session.userId);
      return session && { expiresAt: session.expiresAt, ...user };
    },
    remove: async (tokenHash) => {
      calls.sessionRemove.push(tokenHash);
      const index = stored.findIndex((item) => item.tokenHash === tokenHash);
      if (index !== -1) stored.splice(index, 1);
    },
    removeExpired: async (now) => {
      calls.expiredRemoval.push(now);
    },
  };

  return { rows, stored, calls, clock, tokens, passwordHasher, users, sessions };
}
