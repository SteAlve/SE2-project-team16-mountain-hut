/**
 * DTO TESTS: here go the tests of the validation and of the shape of the answers, named *.test.js.
 * Call the functions with plain values.
 *
 * THE CODE BELOW IS JUST AN EXAMPLE (story MH-01).
 * Delete this file when the first real one exists.
 */
import { describe, it, expect } from 'vitest';
import { parseBookTable } from '../../src/dto/bookings.js';
import { ValidationError } from '../../src/domain/errors.js';

describe('parseBookTable (dto)', () => {
  it('rejects a party size that is not a positive integer', () => {
    expect(() => parseBookTable({ slotId: 1, partySize: 0 })).toThrow(ValidationError);
  });
});
