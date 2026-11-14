import { describe, expect, it, vi } from 'vitest';
import { makeSearchHikers } from '../../src/usecases/searchHikers.js';
import { ForbiddenError, ValidationError } from '../../src/domain/errors.js';

const employee = { id: 1, role: 'EMPLOYEE' };
const hiker = { id: 2, role: 'HIKER' };

describe('searchHikers use case', () => {
  it('trims the search and limits the DAO to 20 regular hikers', async () => {
    const users = { searchHikers: vi.fn().mockResolvedValue([{ id: 4 }]) };
    const search = makeSearchHikers({ users });

    await expect(search({ user: employee, text: '  Ada  ' })).resolves.toEqual([{ id: 4 }]);
    expect(users.searchHikers).toHaveBeenCalledExactlyOnceWith('Ada', 20);
  });

  it('rejects a search shorter than two characters', async () => {
    const users = { searchHikers: vi.fn() };
    const search = makeSearchHikers({ users });

    await expect(search({ user: employee, text: ' A ' }))
      .rejects.toThrow(new ValidationError('The text must have at least 2 characters'));
    expect(users.searchHikers).not.toHaveBeenCalled();
  });

  it('refuses a hiker', async () => {
    const search = makeSearchHikers({ users: { searchHikers: vi.fn() } });

    await expect(search({ user: hiker, text: 'Ada' }))
      .rejects.toThrow(new ForbiddenError('Only the staff can do this'));
  });
});
