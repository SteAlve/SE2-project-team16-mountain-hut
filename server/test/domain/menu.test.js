import { describe, expect, it } from 'vitest';
import { MENU_MAX_LENGTH, normalizeMenu } from '../../src/domain/menu.js';
import { ValidationError } from '../../src/domain/errors.js';

describe('normalizeMenu', () => {
  it('keeps supported formatting and normalizes line endings and boundaries', () => {
    expect(normalizeMenu('**Dinner**  \r\n- Soup  \r\n  - *with* bread\n\n')).toBe(
      '**Dinner**\n- Soup\n  - *with* bread',
    );
  });

  it.each([
    ['', 'MENU_EMPTY'],
    ['  \n-  \n***', 'MENU_EMPTY'],
    ['x'.repeat(MENU_MAX_LENGTH + 1), 'MENU_TOO_LONG'],
    ['# Dinner', 'MENU_FORMAT'],
    ['[Dinner](https://example.com)', 'MENU_FORMAT'],
    ['<b>Dinner</b>', 'MENU_FORMAT'],
    ['  - sub-item', 'MENU_FORMAT'],
    ['- item\n\n  - sub-item', 'MENU_FORMAT'],
  ])('rejects %j with %s', (menu, code) => {
    expect(() => normalizeMenu(menu)).toThrowError(expect.objectContaining({ code }));
  });

  it('counts Unicode code points for the length limit', () => {
    expect(() => normalizeMenu('😀'.repeat(MENU_MAX_LENGTH))).not.toThrow();
    expect(() => normalizeMenu('😀'.repeat(MENU_MAX_LENGTH + 1))).toThrowError(
      expect.objectContaining({ code: 'MENU_TOO_LONG' }),
    );
  });

  it('throws a validation error for invalid menu content', () => {
    expect(() => normalizeMenu('')).toThrow(ValidationError);
  });
});
