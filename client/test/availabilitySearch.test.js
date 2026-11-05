import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookingRouteKey, positiveInteger, readBookingSearch, withoutReviewFlag } from '../src/lib/availabilitySearch.js';

const parse = (params) => readBookingSearch(params, '2026-11-05');

test('a past booking link cannot restore its day or select its stale slot on another day', () => {
  const parsed = parse(new URLSearchParams('date=2026-11-04&slot=42&people=6&from=12:00&to=13:00'));
  assert.equal(parsed.date, undefined);
  assert.equal(parsed.slotId, undefined);
  assert.equal(parsed.partySize, 6);
  assert.equal(parsed.isSearch, true);
});

test('today is valid for a direct booking link', () => {
  assert.equal(parse(new URLSearchParams('date=2026-11-05')).date, '2026-11-05');
});

test('restores the date, party, chosen slot and search range after login', () => {
  assert.deepEqual(parse(new URLSearchParams('date=2028-02-29&people=6&slot=42&from=12:30&to=13:30&review=1')), {
    date: '2028-02-29', partySize: 6, slotId: 42, from: '12:30', to: '13:30', isSearch: true,
  });
});

for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '0000-01-01', '2026-1-01', '<script>']) {
  test(`rejects malformed or impossible calendar day ${date}`, () => {
    assert.equal(parse(new URLSearchParams({ date })).date, undefined);
  });
}

test('accepts a distant valid day without imposing an advance-booking limit', () => {
  assert.equal(parse(new URLSearchParams('date=9999-12-31')).date, '9999-12-31');
});

for (const value of ['', '0', '-1', '1.5', '1e2', ' 2 ', '02', 'NaN', 'Infinity', '9007199254740992']) {
  test(`rejects invalid party or slot integer ${JSON.stringify(value)}`, () => {
    assert.equal(positiveInteger(value), undefined);
    const parsed = parse(new URLSearchParams({ people: value, slot: value }));
    assert.equal(parsed.partySize, undefined);
    assert.equal(parsed.slotId, undefined);
  });
}

test('keeps parties above the hut capacity (PO #27: No limit)', () => {
  assert.equal(positiveInteger('1000000'), 1000000);
  assert.equal(positiveInteger(String(Number.MAX_SAFE_INTEGER)), Number.MAX_SAFE_INTEGER);
});

for (const [from, to] of [['12:00', '12:00'], ['14:00', '12:00'], ['24:00', '25:00'], ['12:60', '13:00'], ['9:00', '10:00'], ['', '13:00'], ['12:00', '']]) {
  test(`ignores the entire invalid range ${from}-${to}`, () => {
    const parsed = parse(new URLSearchParams({ from, to, people: '2' }));
    assert.equal(parsed.isSearch, false);
    assert.equal(parsed.from, undefined);
    assert.equal(parsed.to, undefined);
    assert.equal(parsed.partySize, 2);
  });
}

test('a direct visit without parameters starts with no restored choices', () => {
  assert.deepEqual(parse(new URLSearchParams()), {
    date: undefined, partySize: undefined, slotId: undefined, from: undefined, to: undefined, isSearch: false,
  });
});

test('consumes all review flags without mutating or losing search choices', () => {
  const params = new URLSearchParams('date=2026-11-06&people=10&slot=2&from=12:00&to=14:00&review=1&review=1');
  const clean = withoutReviewFlag(params);
  assert.equal(clean.has('review'), false);
  assert.equal(params.getAll('review').length, 2);
  assert.deepEqual(parse(clean), parse(params));
  assert.equal(withoutReviewFlag(clean).toString(), clean.toString());
});

test('consuming review preserves the route key so the open dialog is not remounted', () => {
  const search = '?date=2026-11-06&people=10&slot=2&from=12%3A00&to=14%3A00&review=1';
  const clean = withoutReviewFlag(new URLSearchParams(search));
  assert.equal(bookingRouteKey(search), bookingRouteKey(`?${clean}`));
  assert.equal(clean.get('review'), null); // Reloading no longer requests automatic review.
});

test('changing an actual search choice still remounts the booking page', () => {
  const original = '?date=2026-11-06&people=2&slot=1&from=12:00&to=14:00';
  for (const [name, value] of [['date', '2026-11-07'], ['people', '6'], ['slot', '2'], ['from', '12:30'], ['to', '15:00']]) {
    const next = new URLSearchParams(original);
    next.set(name, value);
    assert.notEqual(bookingRouteKey(original), bookingRouteKey(`?${next}`));
  }
});
