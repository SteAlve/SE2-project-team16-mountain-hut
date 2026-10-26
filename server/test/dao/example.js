/**
 * DAO TESTS: here go the tests of the queries, named *.test.js. They run on a real database, not
 * on a fake: the SQL is what is being tested. They need the database task.
 *
 * THE CODE BELOW IS JUST AN EXAMPLE (story MH-01). The data is only assumed.
 * Delete this file when the first real one exists.
 */
import { describe, it, expect } from 'vitest';
import * as slotDao from '../../src/dao/slots.js';

describe('slots dao (real database)', () => {
  it('finds a slot by id', async () => {
    expect(await slotDao.findById(1)).toEqual({ id: 1, startsAt: expect.any(Date) });
  });
});
