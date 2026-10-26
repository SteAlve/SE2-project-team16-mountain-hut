import { describe, expect, it } from 'vitest';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableError,
  ValidationError,
} from '../../src/domain/errors.js';

describe('domain errors', () => {
  // The API answers { error: err.name }, so the name must be the name of the class.
  it.each([
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    UnprocessableError,
  ])('%o is a DomainError named after its class', (ErrorClass) => {
    const error = new ErrorClass('something');

    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe(ErrorClass.name);
    expect(error.message).toBe('something');
  });

  it('UnauthorizedError and ForbiddenError have a default message', () => {
    expect(new UnauthorizedError().message).toBe('Authentication required');
    expect(new ForbiddenError().message).toBe('Not allowed');
  });
});
