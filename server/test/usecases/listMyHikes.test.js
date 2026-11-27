import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '../../src/domain/errors.js';
import { clock as realClock } from '../../src/clock.js';
import { makeListMyHikes } from '../../src/usecases/listMyHikes.js';

const zone = 'Europe/Rome';
const user = { id: 7, role: 'HIKER' };
const rows = [
  {
    id: 1,
    start: null,
    destination: 'Lago Chiaretto',
    route: 'Via the lake',
    passagePoints: [],
    departureAt: realClock.at('2090-07-15', '08:00', zone),
    returnAt: realClock.at('2090-07-15', '16:00', zone),
  },
  {
    id: 2,
    start: 'Rifugio',
    destination: 'Passo Alpe Lunga',
    route: 'Ridge path',
    passagePoints: ['Viso Mozzo'],
    departureAt: realClock.at('2090-07-17', '07:30', zone),
    returnAt: realClock.at('2090-07-17', '17:00', zone),
  },
];

describe('listMyHikes', () => {
  it('lists all hikes of the logged-in hiker using hut-local times', async () => {
    const hikes = { findByHiker: vi.fn().mockResolvedValue(rows) };
    const clock = { localDateTime: vi.fn(realClock.localDateTime) };
    const list = makeListMyHikes({ hikes, clock, hutTimeZone: zone });

    await expect(list({ user })).resolves.toMatchObject([
      { id: 1, departureAt: '2090-07-15T08:00' },
      { id: 2, departureAt: '2090-07-17T07:30' },
    ]);
    expect(hikes.findByHiker).toHaveBeenCalledWith(user.id);
  });

  it('refuses non-hikers without querying the DAO', async () => {
    const hikes = { findByHiker: vi.fn() };
    const list = makeListMyHikes({ hikes, clock: {}, hutTimeZone: zone });

    await expect(list({ user: { id: 8, role: 'EMPLOYEE' } })).rejects.toThrow(ForbiddenError);
    expect(hikes.findByHiker).not.toHaveBeenCalled();
  });
});
