import { describe, expect, it } from 'vitest';
import { describeHike, splitLocalDateTime } from '../../src/domain/hike.js';

describe('hike domain helpers', () => {
  it('splits a local date and time', () => {
    expect(splitLocalDateTime('2090-07-18T07:30')).toEqual({ date: '2090-07-18', time: '07:30' });
  });

  it('describes a stored hike using the supplied local-time converter', () => {
    const departureAt = new Date('2090-07-18T05:30:00.000Z');
    const returnAt = new Date('2090-07-18T15:00:00.000Z');
    const hike = {
      id: 12,
      start: null,
      destination: 'Passo Alpe Lunga',
      route: 'Via the lake',
      passagePoints: ['Viso Mozzo'],
      departureAt,
      returnAt,
    };

    expect(describeHike(hike, (instant) => instant.toISOString())).toEqual({
      id: 12,
      start: null,
      destination: 'Passo Alpe Lunga',
      route: 'Via the lake',
      passagePoints: ['Viso Mozzo'],
      departureAt: departureAt.toISOString(),
      returnAt: returnAt.toISOString(),
    });
  });
});
