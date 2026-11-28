import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildHikeRequest,
  HUT_LABEL,
  dropTarget,
  formatHikeRange,
  formatPickedDay,
  insertIndex,
  isNoMove,
  isPastDepartureFailure,
  movePoint,
  POPULAR_HIKES,
  registeredNotice,
  registerFailure,
  sortHikes,
  toMoment,
  validateHike,
} from '../src/lib/hikes.js';

// A fixed now, before the hikes of the tests: 1 July 2027, 12:00 at the hut (summer time, UTC+2). Without it the
// departure of `filled` would be in the past from 17 July 2027.
const NOW = new Date(Date.UTC(2027, 6, 1, 10, 0));
const check = (form) => validateHike(form, NOW);

const filled = {
  start: HUT_LABEL,
  destination: 'Passo Alpe Lunga',
  route: 'Ridge path',
  departureDay: '2027-07-17',
  departureTime: '07:30',
  returnDay: '2027-07-17',
  returnTime: '17:00',
};

test('a complete form has nothing wrong', () => {
  assert.deepEqual(check(filled), {});
});

test('an empty form says what is missing under each field', () => {
  const errors = check({ start: '', destination: '', route: '', departureDay: '', departureTime: '', returnDay: '', returnTime: '' });
  assert.deepEqual(errors, {
    start: 'Enter a starting point.',
    destination: 'Enter a destination.',
    route: 'Describe your route.',
    departure: 'Choose the departure day and time.',
    return: 'Choose the return day and time.',
  });
});

test('text with only spaces counts as missing', () => {
  const errors = check({ ...filled, destination: '   ', route: ' ' });
  assert.equal(errors.destination, 'Enter a destination.');
  assert.equal(errors.route, 'Describe your route.');
});

test('a day without a time (or a time without a day) is missing', () => {
  assert.equal(check({ ...filled, departureTime: '' }).departure, 'Choose the departure day and time.');
  assert.equal(check({ ...filled, returnDay: '' }).return, 'Choose the return day and time.');
});

test('the return must be after the departure, the same moment is not after', () => {
  assert.equal(check({ ...filled, returnTime: '06:00' }).return, 'The return must be after the departure.');
  assert.equal(check({ ...filled, returnTime: '07:30' }).return, 'The return must be after the departure.');
  assert.equal(check({ ...filled, returnDay: '2027-07-16' }).return, 'The return must be after the departure.');
  assert.equal(check({ ...filled, returnDay: '2027-07-18', returnTime: '06:00' }).return, undefined);
});

test('the order of the times is not checked while one is missing', () => {
  assert.equal(check({ ...filled, departureTime: '' }).return, undefined);
});

test('the departure cannot be in the past, the current minute at the hut is not past', () => {
  const at = (departureDay, departureTime) => check({ ...filled, departureDay, departureTime }).departure;
  assert.equal(at('2027-07-01', '11:59'), 'The departure cannot be in the past.');
  assert.equal(at('2027-06-30', '18:00'), 'The departure cannot be in the past.');
  assert.equal(at('2027-07-01', '12:00'), undefined);
  assert.equal(at('2027-07-01', '12:05'), undefined);
});

test('the start is the hut until it is changed, and it cannot be left empty', () => {
  assert.equal(check({ ...filled, start: '  ' }).start, 'Enter a starting point.');
  assert.equal(check({ ...filled, start: 'Rifugio Basso' }).start, undefined);
});

test('the start is sent only when the hiker changed it', () => {
  assert.equal('start' in buildHikeRequest(filled, []), false);
  assert.equal('start' in buildHikeRequest({ ...filled, start: ` ${HUT_LABEL} ` }, []), false);
  assert.equal(buildHikeRequest({ ...filled, start: ' Rifugio Basso ' }, []).start, 'Rifugio Basso');
});

test('the request has the trimmed text, the moments of the hut and the points in order', () => {
  const points = [
    { id: 1, text: ' Colle Basso ' },
    { id: 2, text: '' },
    { id: 3, text: 'Pian dei Fiori' },
  ];
  assert.deepEqual(buildHikeRequest({ ...filled, destination: ' Passo Alpe Lunga ' }, points), {
    destination: 'Passo Alpe Lunga',
    route: 'Ridge path',
    passagePoints: ['Colle Basso', 'Pian dei Fiori'],
    departureAt: '2027-07-17T07:30',
    returnAt: '2027-07-17T17:00',
  });
});

test('a hike without passage points sends an empty list', () => {
  assert.deepEqual(buildHikeRequest(filled, []).passagePoints, []);
});

test('toMoment joins a day and a time, or is empty', () => {
  assert.equal(toMoment('2027-07-17', '07:30'), '2027-07-17T07:30');
  assert.equal(toMoment('', '07:30'), '');
});

test('the day of the field shows the year only when it is not the current one', () => {
  const now = new Date(2026, 10, 26);
  assert.equal(formatPickedDay('2026-12-24', now), 'Thu 24 Dec');
  assert.equal(formatPickedDay('2027-07-17', now), 'Sat 17 Jul 2027');
});

test('the hikes are listed by departure', () => {
  const list = [
    { id: 3, departureAt: '2027-07-25T06:30' },
    { id: 1, departureAt: '2027-07-15T08:00' },
    { id: 2, departureAt: '2027-07-15T08:00' },
  ];
  assert.deepEqual(sortHikes(list).map((h) => h.id), [1, 2, 3]);
});

test('the range of a hike names the day once, or both days when it ends on another day', () => {
  assert.equal(formatHikeRange({ departureAt: '2027-07-15T08:00', returnAt: '2027-07-15T16:30' }), 'Thu 15 Jul, 08:00 – 16:30');
  assert.equal(
    formatHikeRange({ departureAt: '2027-07-15T08:00', returnAt: '2027-07-16T16:30' }),
    'Thu 15 Jul, 08:00 – Fri 16 Jul, 16:30',
  );
});

test('the overlap names the hike in the way and says nothing was saved', () => {
  const error = {
    status: 409,
    code: 'HIKE_OVERLAP',
    message: 'The times overlap your hike to Lago Chiaretto, from 2027-07-15T08:00 to 2027-07-15T16:30',
    details: { hike: { destination: 'Lago Chiaretto', departureAt: '2027-07-15T08:00', returnAt: '2027-07-15T16:30' } },
  };
  assert.equal(
    registerFailure(error),
    'These times overlap your hike to Lago Chiaretto (Thu 15 Jul, 08:00 – 16:30). Choose other times. Nothing has been saved.',
  );
});

test('a refusal the server explains shows its message as a sentence', () => {
  assert.equal(
    registerFailure({ status: 400, message: 'The return must be after the departure' }),
    'The return must be after the departure. Nothing has been saved.',
  );
  assert.equal(
    registerFailure({ status: 403, message: 'Only hikers can register a hike' }),
    'Only hikers can register a hike. Nothing has been saved.',
  );
});

test('the server refusing a departure in the past is told apart from the other refusals', () => {
  assert.equal(isPastDepartureFailure({ status: 400, message: 'The departure cannot be in the past' }), true);
  assert.equal(isPastDepartureFailure({ status: 400, message: 'The return must be after the departure' }), false);
  assert.equal(isPastDepartureFailure({ status: 409, message: 'The departure cannot be in the past' }), false);
});

test('the network and the server give the generic note', () => {
  const generic = 'Something went wrong on our side. Try again in a minute. Nothing has been saved.';
  assert.equal(registerFailure({ status: 0, message: 'Unable to reach the server' }), generic);
  assert.equal(registerFailure({ status: 500, message: 'Unexpected error' }), generic);
});

test('a 409 without the hike in the way still says nothing was saved', () => {
  assert.equal(registerFailure({ status: 409, code: 'HIKE_OVERLAP', message: 'Overlap' }), 'Overlap. Nothing has been saved.');
});

test('the note of a registered hike names the destination and the email', () => {
  assert.equal(
    registeredNotice({ destination: 'Passo Alpe Lunga' }, 'giulia.rossi@example.com'),
    'Your hike to Passo Alpe Lunga is registered. We emailed the confirmation to giulia.rossi@example.com.',
  );
});

test('moving a point changes the order and leaves the list as it was', () => {
  const list = ['a', 'b', 'c'];
  assert.deepEqual(movePoint(list, 2, 0), ['c', 'a', 'b']);
  assert.deepEqual(movePoint(list, 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(list, ['a', 'b', 'c']);
});

test('moving a point to its place, or outside the list, changes nothing', () => {
  const list = ['a', 'b'];
  assert.equal(movePoint(list, 1, 1), list);
  assert.equal(movePoint(list, 0, 2), list);
  assert.equal(movePoint(list, -1, 0), list);
});

test('the line is before the first row whose middle is below the pointer', () => {
  const rows = [
    { top: 0, height: 40 },
    { top: 50, height: 40 },
    { top: 100, height: 40 },
  ];
  assert.equal(insertIndex(5, rows), 0);
  assert.equal(insertIndex(60, rows), 1);
  assert.equal(insertIndex(95, rows), 2);
  assert.equal(insertIndex(500, rows), 3);
});

test('dropping a point takes it out of its place first', () => {
  assert.equal(dropTarget(0, 3), 2);
  assert.equal(dropTarget(2, 0), 0);
  assert.equal(dropTarget(1, 1), 1);
  assert.equal(dropTarget(1, 2), 1);
});

test('dropping before itself or right after itself moves nothing', () => {
  assert.equal(isNoMove(1, 1), true);
  assert.equal(isNoMove(1, 2), true);
  assert.equal(isNoMove(1, 0), false);
  assert.equal(isNoMove(1, 3), false);
});

test('the popular hikes are the three of the mockup, each with its own id', () => {
  assert.deepEqual(POPULAR_HIKES.map((h) => h.destination), ['Lago Chiaretto', 'Passo Alpe Lunga', 'Cima Rossa']);
  assert.equal(new Set(POPULAR_HIKES.map((h) => h.id)).size, 3);
});
