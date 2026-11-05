// URL choices are untrusted. Keep valid staff dates and positive integers; ignore malformed values.
import { toDay } from './bookingDates.js';
export const positiveInteger = (value) => {
  if (!/^[1-9]\d*$/.test(value ?? '')) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : undefined;
};

const calendarDay = (value) => {
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return undefined;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : undefined;
};

export function readBookingSearch(params, today = toDay(new Date())) {
  const date = calendarDay(params.get('date'));
  const past = Boolean(date && date < today);
  const from = params.get('from');
  const to = params.get('to');
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  const isSearch = time.test(from ?? '') && time.test(to ?? '') && to > from;
  return {
    date: past ? undefined : date,
    partySize: positiveInteger(params.get('people')),
    slotId: past ? undefined : positiveInteger(params.get('slot')),
    from: isSearch ? from : undefined,
    to: isSearch ? to : undefined,
    isSearch,
  };
}

// Removing the one-shot flag must preserve the review component and all search choices.
export function withoutReviewFlag(params) {
  const next = new URLSearchParams(params);
  next.delete('review');
  return next;
}

export const bookingRouteKey = (search) => withoutReviewFlag(new URLSearchParams(search)).toString();
