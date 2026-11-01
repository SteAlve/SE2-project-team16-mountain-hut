import { describe, expect, it } from 'vitest';
import { hash, verify } from '../src/passwordHasher.js';
import { generate, hash as hashToken } from '../src/sessionTokens.js';

describe('passwordHasher', () => {
  it('verifies the right password and refuses a wrong one', async () => {
    const stored = await hash('correct horse');
    expect(stored.startsWith('scrypt$')).toBe(true);
    await expect(verify('correct horse', stored)).resolves.toBe(true);
    await expect(verify('wrong', stored)).resolves.toBe(false);
  });

  it('salts: the same password gives different hashes', async () => {
    expect(await hash('same')).not.toBe(await hash('same'));
  });

  it('refuses when there is no stored hash or it is malformed', async () => {
    await expect(verify('x', undefined)).resolves.toBe(false);
    await expect(verify('x', 'garbage')).resolves.toBe(false);
  });
});

describe('sessionTokens', () => {
  it('generates a random id whose hash is what gets stored', () => {
    const a = generate();
    const b = generate();
    expect(a.id).not.toBe(b.id);
    expect(a.id.length).toBeGreaterThanOrEqual(43);
    expect(a.hash).toBe(hashToken(a.id));
    expect(a.hash).not.toBe(a.id);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
