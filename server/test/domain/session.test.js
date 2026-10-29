import { describe, expect, it } from 'vitest';
import { isSessionActive } from '../../src/domain/session.js';

describe('isSessionActive', () => {
  const now = new Date('2026-01-01T12:00:00Z');

  it('is active before the expiry and over from the expiry instant on', () => {
    expect(isSessionActive(new Date('2026-01-01T12:00:01Z'), now)).toBe(true);
    expect(isSessionActive(new Date('2026-01-01T12:00:00Z'), now)).toBe(false);
    expect(isSessionActive(new Date('2026-01-01T11:00:00Z'), now)).toBe(false);
  });
});
