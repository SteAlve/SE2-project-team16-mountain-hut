import { describe, expect, it } from 'vitest';
import { parseRegisterHike, toHikeDto } from '../../src/dto/hikes.js';
import { ValidationError } from '../../src/domain/errors.js';

const valid = {
  start: 'Rifugio Quintino Sella',
  destination: 'Passo Alpe Lunga',
  route: 'Via the Chiaretto lake',
  passagePoints: ['Viso Mozzo', 'Lago Chiaretto'],
  departureAt: '2090-07-18T07:30',
  returnAt: '2090-07-18T17:00',
};

describe('hike DTOs', () => {
  it('parses and trims a complete hike request', () => {
    expect(parseRegisterHike({ ...valid, destination: '  Passo Alpe Lunga  ' })).toEqual({
      ...valid,
      destination: 'Passo Alpe Lunga',
    });
  });

  it('defaults start and passage points to the hut and an empty list', () => {
    expect(parseRegisterHike({ ...valid, start: undefined, passagePoints: undefined })).toMatchObject({
      start: null,
      passagePoints: [],
    });
  });

  it.each([
    ['destination', { ...valid, destination: '' }],
    ['route', { ...valid, route: '   ' }],
    ['departureAt', { ...valid, departureAt: '2090-07-18 07:30' }],
    ['returnAt', { ...valid, returnAt: '2090-02-30T17:00' }],
    ['passagePoints', { ...valid, passagePoints: ['Viso Mozzo\nLago Chiaretto'] }],
  ])('rejects invalid %s', (_field, body) => {
    expect(() => parseRegisterHike(body)).toThrow(ValidationError);
  });

  it('rejects unknown fields and an invalid passage-point collection', () => {
    expect(() => parseRegisterHike({ ...valid, popularHikeId: 1 })).toThrow(ValidationError);
    expect(() => parseRegisterHike({ ...valid, passagePoints: 'Viso Mozzo' })).toThrow(ValidationError);
  });

  it('maps the saved hike to the API DTO', () => {
    const hike = { ...valid, id: 12 };
    expect(toHikeDto(hike)).toEqual(hike);
  });
});
