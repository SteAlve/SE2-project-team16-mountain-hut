import { describe, expect, it } from 'vitest';
import { requireStaff } from '../../src/usecases/requireStaff.js';
import { ForbiddenError } from '../../src/domain/errors.js';

describe('requireStaff', () => {
  it.each([['EMPLOYEE'], ['WARDEN']])('lets a %s through', (role) => {
    expect(() => requireStaff({ id: 1, role })).not.toThrow();
  });

  it.each([['HIKER'], ['hiker'], ['ADMIN'], [undefined]])('answers 403 to the role %s', (role) => {
    expect(() => requireStaff({ id: 1, role })).toThrow(new ForbiddenError('Only the staff can do this'));
  });
});
