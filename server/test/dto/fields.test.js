import { describe, expect, it } from 'vitest';
import {
  rejectUnknownFields,
  requireDate,
  requireObject,
  requirePositiveInteger,
  requirePositiveIntegerText,
  requireTime,
  toHourMinute,
} from '../../src/dto/fields.js';
import { ValidationError } from '../../src/domain/errors.js';

const fails = (fn, message) => expect(fn).toThrow(new ValidationError(message));

describe('requireObject', () => {
  it('accepts an object and returns it', () => {
    const body = { a: 1 };
    expect(requireObject(body)).toBe(body);
    expect(requireObject({})).toEqual({});
  });

  it.each([[null], [undefined], [[1]], ['text'], [3]])('rejects %j', (value) => {
    fails(() => requireObject(value), 'Request body must be a JSON object');
  });

  it('uses the message it is given', () => {
    fails(() => requireObject(null, 'Each table must be an object'), 'Each table must be an object');
  });
});

describe('rejectUnknownFields', () => {
  it('accepts the allowed fields, also fewer of them', () => {
    expect(() => rejectUnknownFields({ a: 1 }, ['a', 'b'])).not.toThrow();
    expect(() => rejectUnknownFields({}, ['a'])).not.toThrow();
  });

  it('names the first field that is not allowed, and where', () => {
    fails(() => rejectUnknownFields({ a: 1, role: 'x', other: 2 }, ['a']), 'Unknown field: role');
    fails(() => rejectUnknownFields({ seats: 1 }, ['capacity'], ' in tables'), 'Unknown field in tables: seats');
  });
});

describe('requirePositiveInteger', () => {
  it('accepts a positive integer', () => {
    expect(requirePositiveInteger(1, 'slotId')).toBe(1);
    expect(requirePositiveInteger(Number.MAX_SAFE_INTEGER, 'slotId')).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each([[0], [-1], [1.5], ['1'], [null], [undefined], [NaN], [Infinity], [2 ** 60], [[1]]])('rejects %j', (value) => {
    fails(() => requirePositiveInteger(value, 'slotId'), 'slotId must be a positive integer');
  });
});

describe('requirePositiveIntegerText', () => {
  it('turns the text of a positive integer into a number', () => {
    expect(requirePositiveIntegerText('12', 'slotId')).toBe(12);
  });

  it.each([['0'], ['012'], ['-3'], ['1.5'], ['1e3'], [' 1'], [''], ['abc'], [12], [['1', '2']], [undefined]])('rejects %j', (value) => {
    fails(() => requirePositiveIntegerText(value, 'partySize'), 'partySize must be a positive integer');
  });
});

describe('requireDate', () => {
  it('accepts a day that exists, leap days included', () => {
    expect(requireDate('2026-10-28', 'date')).toBe('2026-10-28');
    expect(requireDate('2028-02-29', 'date')).toBe('2028-02-29');
  });

  it.each([['2026-02-30'], ['2027-02-29'], ['2026-13-01'], ['2026-00-10'], ['2026-1-5'], ['28/10/2026'], ['2026-10-28T10:00'], [''], [20261028], [null], [undefined], [['2026-10-28']]])('rejects %j', (value) => {
    fails(() => requireDate(value, 'from'), 'from must be a valid date');
  });
});

describe('requireTime', () => {
  it('accepts HH:MM from 00:00 to 23:59', () => {
    expect(requireTime('00:00', 'startsAt')).toBe('00:00');
    expect(requireTime('12:30', 'startsAt')).toBe('12:30');
    expect(requireTime('23:59', 'startsAt')).toBe('23:59');
  });

  it.each([['24:00'], ['12:60'], ['1:30'], ['12:5'], ['12:00:00'], ['12.30'], [' 12:30'], [''], [1230], [null], [undefined]])('rejects %j', (value) => {
    fails(() => requireTime(value, 'endsAt'), 'endsAt must be a valid time (HH:MM)');
  });
});

describe('toHourMinute', () => {
  it('cuts the seconds of a time from the database', () => {
    expect(toHourMinute('12:00:00')).toBe('12:00');
    expect(toHourMinute('09:05:30')).toBe('09:05');
    expect(toHourMinute('12:00')).toBe('12:00');
  });
});
