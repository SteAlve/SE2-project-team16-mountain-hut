// URL choices are untrusted. Keep valid staff dates and positive integers; ignore malformed values.
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

export function readBookingSearch(params) {
  const from = params.get('from');
  const to = params.get('to');
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  const isSearch = time.test(from ?? '') && time.test(to ?? '') && to > from;
  return {
    date: calendarDay(params.get('date')),
    partySize: positiveInteger(params.get('people')),
    slotId: positiveInteger(params.get('slot')),
    from: isSearch ? from : undefined,
    to: isSearch ? to : undefined,
    isSearch,
  };
}
