import { describe, expect, it, vi } from 'vitest';
import { clock as realClock } from '../../src/clock.js';
import { ForbiddenError, ValidationError } from '../../src/domain/errors.js';
import { makeRegisterHike } from '../../src/usecases/registerHike.js';
import { makeRegisterHikeAndNotify } from '../../src/usecases/registerHikeAndNotify.js';

const zone = 'Europe/Rome';
const hiker = { id: 7, role: 'HIKER', firstName: 'Mara', lastName: 'Rossi', email: 'mara@example.com' };
const employee = { id: 8, role: 'EMPLOYEE' };
const input = {
  user: hiker,
  start: null,
  destination: 'Passo Alpe Lunga',
  route: 'Via the Chiaretto lake',
  passagePoints: ['Viso Mozzo'],
  departureAt: '2090-07-18T07:30',
  returnAt: '2090-07-18T17:00',
};
const now = realClock.at('2090-07-17', '12:00', zone);

const setup = ({ inserted = null, overlapping = null, current = now } = {}) => {
  const departure = realClock.at('2090-07-18', '07:30', zone);
  const back = realClock.at('2090-07-18', '17:00', zone);
  const saved = inserted ?? {
    id: 12,
    start: null,
    destination: input.destination,
    route: input.route,
    passagePoints: input.passagePoints,
    departureAt: departure,
    returnAt: back,
    createdAt: realClock.at('2090-07-17', '12:01', zone),
  };
  const hikes = {
    insert: vi.fn().mockResolvedValue(inserted === null ? saved : inserted),
    findOverlapping: vi.fn().mockResolvedValue(overlapping),
  };
  const clock = {
    at: vi.fn(realClock.at),
    now: vi.fn(() => current),
    localDateTime: vi.fn(realClock.localDateTime),
  };
  return {
    hikes,
    clock,
    register: makeRegisterHike({ hikes, clock, hutTimeZone: zone }),
    departure,
    back,
  };
};

describe('registerHike', () => {
  it('converts local times, saves the hike and returns local times', async () => {
    const test = setup();

    await expect(test.register(input)).resolves.toMatchObject({
      id: 12,
      destination: input.destination,
      passagePoints: ['Viso Mozzo'],
      departureAt: input.departureAt,
      returnAt: input.returnAt,
      registeredAt: '2090-07-17T12:01',
    });
    expect(test.hikes.insert).toHaveBeenCalledWith({
      hikerId: hiker.id,
      start: null,
      destination: input.destination,
      route: input.route,
      passagePoints: ['Viso Mozzo'],
      departureAt: test.departure,
      returnAt: test.back,
    });
  });

  it('accepts a departure in the current minute but rejects one in the past', async () => {
    const current = realClock.at('2090-07-18', '07:30', zone);
    const test = setup({ current });
    const currentMinute = { ...input, departureAt: '2090-07-18T07:30' };
    await expect(test.register(currentMinute)).resolves.toBeDefined();

    const past = setup({ current });
    await expect(past.register({ ...input, departureAt: '2090-07-18T07:29' })).rejects.toThrow(ValidationError);
    expect(past.hikes.insert).not.toHaveBeenCalled();
  });

  it('requires the return to be later than departure', async () => {
    const test = setup();

    await expect(test.register({ ...input, returnAt: input.departureAt })).rejects.toThrow(ValidationError);
    await expect(test.register({ ...input, returnAt: '2090-07-18T07:00' })).rejects.toThrow(ValidationError);
    expect(test.hikes.insert).not.toHaveBeenCalled();
  });

  it('rejects overlapping hikes and allows the hiker to start when another ends', async () => {
    const other = {
      id: 3,
      start: null,
      destination: 'Lago Chiaretto',
      route: 'Old route',
      passagePoints: [],
      departureAt: realClock.at('2090-07-18', '06:00', zone),
      returnAt: realClock.at('2090-07-18', '08:00', zone),
    };
    const rejected = setup({ inserted: null, overlapping: other });
    rejected.hikes.insert.mockResolvedValue(null);
    await expect(rejected.register(input)).rejects.toMatchObject({ code: 'HIKE_OVERLAP' });
    expect(rejected.hikes.findOverlapping).toHaveBeenCalled();

    const adjacent = setup();
    await expect(adjacent.register({
      ...input,
      departureAt: '2090-07-18T17:00',
      returnAt: '2090-07-18T19:00',
    })).resolves.toBeDefined();
  });

  it('allows only hikers to register', async () => {
    const test = setup();

    await expect(test.register({ ...input, user: employee })).rejects.toThrow(ForbiddenError);
    expect(test.clock.at).not.toHaveBeenCalled();
    expect(test.hikes.insert).not.toHaveBeenCalled();
  });
});

describe('registerHikeAndNotify', () => {
  it('sends the confirmation after saving and keeps the hike when email fails', async () => {
    const hike = {
      id: 12,
      start: null,
      destination: 'Passo Alpe Lunga',
      route: 'Via the lake',
      passagePoints: ['Viso Mozzo'],
      departureAt: '2090-07-18T07:30',
      returnAt: '2090-07-18T17:00',
      registeredAt: '2090-07-17T12:01',
    };
    const register = vi.fn().mockResolvedValue(hike);
    const mailer = { send: vi.fn().mockRejectedValue(new Error('SMTP unavailable')) };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(makeRegisterHikeAndNotify({ registerHike: register, mailer })(input)).resolves.toBe(hike);
    expect(register).toHaveBeenCalledWith(input);
    expect(mailer.send).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
