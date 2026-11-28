import { describe, expect, it } from 'vitest';
import {
  parseDeleteSlotMenu,
  parseGetSlotMenu,
  parseListPreviousMenus,
  parseSaveSlotMenu,
  toPreviousMenusDto,
  toSlotMenuDto,
} from '../../src/dto/menus.js';
import { ValidationError } from '../../src/domain/errors.js';

describe('menu DTOs', () => {
  it('parses a save request and rejects unknown or non-text fields', () => {
    expect(parseSaveSlotMenu({ slotId: '12' }, { menu: 'Soup' })).toEqual({ slotId: 12, menu: 'Soup' });
    expect(() => parseSaveSlotMenu({ slotId: '12' }, { menu: 'Soup', extra: true })).toThrow(ValidationError);
    expect(() => parseSaveSlotMenu({ slotId: '12' }, { menu: 12 })).toThrow(ValidationError);
  });

  it('parses slot ids and previous-menu query defaults', () => {
    expect(parseDeleteSlotMenu({ slotId: '12' })).toEqual({ slotId: 12 });
    expect(parseGetSlotMenu({ slotId: '12' })).toEqual({ slotId: 12 });
    expect(parseListPreviousMenus({ search: '  soup  ' })).toEqual({
      exceptSlotId: null,
      search: 'soup',
      limit: 10,
      offset: 0,
    });
    expect(parseListPreviousMenus({ exceptSlotId: '12', limit: '20', offset: '5' })).toEqual({
      exceptSlotId: 12,
      search: null,
      limit: 20,
      offset: 5,
    });
  });

  it('rejects invalid ids and pagination values', () => {
    expect(() => parseGetSlotMenu({ slotId: '0' })).toThrow(ValidationError);
    expect(() => parseListPreviousMenus({ limit: '51' })).toThrow(ValidationError);
    expect(() => parseListPreviousMenus({ offset: '-1' })).toThrow(ValidationError);
  });

  it('maps menu rows to the public DTO shape', () => {
    const row = { slotId: 12, date: '2090-07-18', startsAt: '19:00:00', endsAt: '21:00:00', menu: 'Soup' };
    expect(toSlotMenuDto(row)).toEqual({ slotId: 12, date: '2090-07-18', startsAt: '19:00', endsAt: '21:00', menu: 'Soup' });
    expect(toPreviousMenusDto({ menus: [row], hasMore: true })).toEqual({
      menus: [expect.objectContaining({ slotId: 12, menu: 'Soup' })],
      hasMore: true,
    });
  });
});
