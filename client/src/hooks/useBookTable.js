/**
 * HOOKS: the "Book a table" page (story MH-01, mockup docs/mockups/booking).
 * Loads the slots from today on, keeps the hiker's choices, shows where the party would sit and books.
 *
 *   days                   [{ date, hasSlots }] the day strip; hasSlots is undefined while loading
 *   showMoreDays()         adds the next days to the strip (it has no end)
 *   date, partySize        the chosen day and party size; maxPartySize is the top of the stepper
 *   slots                  [{ slotId, startsAt, endsAt, freeSeats, bookable, label }] of the chosen day
 *   slot                   the chosen slot, or null (a slot that stops fitting is not chosen any more)
 *   now                    the current time, updated every 30 seconds
 *   review()               asks the server where the party would sit, then opens the check dialog
 *   isReviewing            true while the check dialog is open; back() closes it
 *   tables                 [{ tableNumber, seats }] of the seating preview, while reviewing
 *   reviewNotice           a message for the check dialog (the tables changed just now), or null
 *   confirm()              books the tables of the preview; resolves to 'booked', 'login' (401: log
 *                          in first) or 'failed'
 *   isPending              true while waiting for the server
 *   alert                  the message of the last failure, or null
 *   booking                the saved booking { id, date, partySize, tables, slot }, or null
 *   startOver()            forgets the booking to book another table
 *
 * `initial` ({ date, partySize, slotId }, all optional) restores the choices, e.g. after the login.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createBooking } from '../api/bookings.js';
import { getSeating, getSlots } from '../api/slots.js';
import { daysBetween, formatClosingTime, formatTime, nextDays, toDay } from '../lib/bookingDates.js';
import { seats, slotAvailability } from '../lib/slotAvailability.js';
import { findSearchSlots } from '../lib/availabilitySlots.js';

// The strip grows in pages; restoring a distant day does not render every date from today.
const DAYS_PER_PAGE = 14;
const TICK_MS = 30 * 1000;
const GENERIC_ERROR = 'Something went wrong on our side. Try again in a minute.';
const TABLES_CHANGED = 'The free tables changed just now. Check where your party sits and confirm again.';

// { 'YYYY-MM-DD': [slot, ...] }, in the order of the server.
const byDate = (slots) =>
  slots.reduce((days, slot) => ({ ...days, [slot.date]: [...(days[slot.date] ?? []), slot] }), {});

export function useBookTable(initial = {}) {
  const [now, setNow] = useState(() => new Date());
  const [start, setStart] = useState(() => {
    const today = new Date();
    const ahead = daysBetween(toDay(today), initial.date);
    if (ahead >= DAYS_PER_PAGE) {
      const requested = new Date(`${initial.date}T12:00:00`);
      requested.setDate(requested.getDate() - (ahead > 0 ? 7 : 0));
      return requested;
    }
    return today;
  });
  // Restore distant days with a bounded window rather than rendering every intervening date.
  const [dayCount, setDayCount] = useState(DAYS_PER_PAGE);
  const dates = useMemo(() => nextDays(start, dayCount), [start, dayCount]);
  const [slotsByDate, setSlotsByDate] = useState(null); // null while loading
  const [loadError, setLoadError] = useState(false);
  const [chosenDate, setChosenDate] = useState(initial.date ?? null);
  const [chosenPartySize, setChosenPartySize] = useState(initial.partySize ?? 1);
  // Undefined means an untouched search: select its only matching slot automatically.
  const [slotId, setSlotId] = useState(initial.slotId ?? (initial.from ? undefined : null));
  const [isReviewing, setIsReviewing] = useState(false);
  const [tables, setTables] = useState(null);
  const [reviewNotice, setReviewNotice] = useState(null);
  const [isPending, setIsPending] = useState(false);
  const [alert, setAlert] = useState(null);
  const [booking, setBooking] = useState(null);

  // The server sends every slot from today on at once: the strip only shows more of them.
  const loadSlots = useCallback(async () => {
    const loaded = byDate(await getSlots());
    setSlotsByDate(loaded);
    setLoadError(false);
    return loaded;
  }, []);
  const updateSlots = useCallback((slots) => {
    setSlotsByDate(byDate(slots));
    setLoadError(false);
  }, []);

  useEffect(() => {
    let active = true;
    getSlots().then(
      (slots) => { if (active) setSlotsByDate(byDate(slots)); },
      () => {
        if (!active) return;
        // Without the slots every day counts as a day with no slots.
        setSlotsByDate({});
        setLoadError(true);
        setAlert(GENERIC_ERROR);
      },
    );
    return () => { active = false; };
  }, []);

  // The hut's server decides the deadline in its own time zone; a visitor's browser clock cannot.
  useEffect(() => {
    if (booking) return;
    const timer = setInterval(() => {
      setNow(new Date());
      loadSlots().catch(() => {});
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [loadSlots, booking]);

  const showMoreDays = useCallback(() => setDayCount((count) => count + DAYS_PER_PAGE), []);
  const minimumDay = toDay(now);
  const showEarlierDays = () => {
    const earlier = new Date(start);
    earlier.setDate(earlier.getDate() - Math.min(DAYS_PER_PAGE, daysBetween(minimumDay, toDay(start))));
    setDayCount((count) => count + daysBetween(toDay(earlier), toDay(start)));
    setStart(earlier);
  };

  const days = dates.map((date) => ({ date, hasSlots: slotsByDate ? Boolean(slotsByDate[date]?.length) : undefined }));

  // Until the hiker picks a day, the first day with a time still open is chosen.
  const hasOpenSlot = (day) => (slotsByDate?.[day] ?? []).some((s) => slotAvailability(s, day, 1, now).bookable);
  const date = (chosenDate && dates.includes(chosenDate) ? chosenDate : null)
    ?? dates.find(hasOpenSlot)
    ?? days.find((day) => day.hasSlots)?.date
    ?? null;

  const from = initial.from;
  const to = initial.to;
  const isSearch = Boolean(from && to);
  const daySlots = useMemo(() => (date && slotsByDate?.[date]) || [], [date, slotsByDate]);
  // PO clarification #27: no business limit. This cap only preserves exact JavaScript integers;
  // it is also used by the stepper to disable incrementing beyond representable party sizes.
  const maxPartySize = Number.MAX_SAFE_INTEGER;
  const partySize = chosenPartySize;

  const slots = daySlots.map((s) => ({ ...s, ...slotAvailability(s, date, partySize, now) }));
  const { overlapping: overlappingSlots, candidates: matches, automatic } = isSearch
    ? findSearchSlots(slots, from, to)
    : { overlapping: [], candidates: [], automatic: null };
  // While the check dialog is open the slot stays chosen even if the clock closes it: the server
  // answers the confirm, and the dialog does not go blank under the hiker.
  const selectedId = slotId === undefined ? automatic?.slotId : slotId;
  const slot = slots.find((s) => s.slotId === selectedId && (isSearch || s.bookable || isReviewing)) ?? null;

  const chooseDate = (next) => {
    setChosenDate(next);
    setSlotId(isSearch ? undefined : null);
  };

  // The seats are gone, the time closed or the slot is no more: reload, keep the day and the party.
  const showFailure = async (error, failed) => {
    if (![404, 409, 422].includes(error.status)) {
      setAlert(error.status === 403 ? error.message : GENERIC_ERROR);
      return;
    }
    const fresh = (await loadSlots().catch(() => null))?.[date] ?? daySlots;
    const latest = fresh.find((s) => s.slotId === failed.slotId);
    setSlotId(null);
    if (error.status === 409) {
      setAlert(`Those seats were just taken. ${formatTime(failed.startsAt)} now has ${seats(latest?.freeSeats ?? 0)} free. Choose another time or fewer people.`);
    } else if (error.status === 404 || !latest) {
      setAlert(`${formatTime(failed.startsAt)} cannot be booked any more. Choose another time.`);
    } else if (!latest.bookingOpen) {
      const closesAt = latest.bookingClosesAt?.slice(11, 16) || formatClosingTime(date, failed.startsAt);
      setAlert(`Booking for ${formatTime(failed.startsAt)} closed at ${closesAt}. Choose another time.`);
    } else {
      // e.g. the hiker already has a booking for this time: the server says it.
      setAlert(error.message);
    }
  };

  const review = async () => {
    if (!slot || isPending) return;
    setIsPending(true);
    setAlert(null);
    setReviewNotice(null);
    try {
      const seating = await getSeating(slot.slotId, partySize);
      setTables(seating.tables);
      setIsReviewing(true);
    } catch (error) {
      await showFailure(error, slot);
    } finally {
      setIsPending(false);
    }
  };

  const confirm = async () => {
    if (!slot || !tables || isPending) return 'failed';
    setIsPending(true);
    setAlert(null);
    setReviewNotice(null);
    try {
      const saved = await createBooking({ slotId: slot.slotId, partySize, tables });
      setBooking({ ...saved, slot });
      setIsReviewing(false);
      return 'booked';
    } catch (error) {
      let failure = error;
      if (error.status === 409 && error.code === 'TABLES_CHANGED') {
        // The party still fits, at other tables: show them in the dialog and let the hiker confirm again.
        try {
          setTables((await getSeating(slot.slotId, partySize)).tables);
          setReviewNotice(TABLES_CHANGED);
          return 'failed';
        } catch (previewError) {
          failure = previewError;
        }
      }
      setIsReviewing(false);
      if (failure.status === 401) return 'login';
      await showFailure(failure, slot);
      return 'failed';
    } finally {
      setIsPending(false);
    }
  };

  const back = () => {
    setIsReviewing(false);
    setReviewNotice(null);
  };

  const startOver = () => {
    setBooking(null);
    setTables(null);
    setSlotId(null);
    setChosenPartySize(1);
    setAlert(null);
    loadSlots().catch(() => {});
  };

  return {
    days,
    showMoreDays,
    showEarlierDays,
    canShowEarlierDays: toDay(start) > minimumDay,
    date,
    chooseDate,
    partySize,
    maxPartySize,
    setPartySize: (n) => setChosenPartySize(Math.max(1, Math.min(n, maxPartySize))),
    slots,
    updateSlots,
    loadError,
    matchingCount: matches.length,
    overlappingCount: overlappingSlots.length,
    isLoading: slotsByDate === null,
    slot,
    chooseSlot: setSlotId,
    now,
    isReviewing,
    tables,
    reviewNotice,
    review,
    back,
    confirm,
    isPending,
    alert,
    booking,
    startOver,
  };
}
