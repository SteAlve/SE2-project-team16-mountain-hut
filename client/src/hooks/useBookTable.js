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
import { largestParty, seats, slotAvailability } from '../lib/slotAvailability.js';

// The strip has no end: it grows by this many days as the hiker scrolls (open question #26).
const DAYS_PER_PAGE = 14;
const TICK_MS = 30 * 1000;
const GENERIC_ERROR = 'Something went wrong on our side. Try again in a minute.';
const TABLES_CHANGED = 'The free tables changed just now. Check where your party sits and confirm again.';

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}

// { 'YYYY-MM-DD': [slot, ...] }, in the order of the server.
const byDate = (slots) =>
  slots.reduce((days, slot) => ({ ...days, [slot.date]: [...(days[slot.date] ?? []), slot] }), {});

export function useBookTable(initial = {}) {
  const now = useNow();
  const [start] = useState(() => new Date());
  // A restored day further ahead is already in the strip.
  const [dayCount, setDayCount] = useState(() => {
    const ahead = daysBetween(toDay(start), initial.date);
    return ahead >= 0 ? (Math.floor(ahead / DAYS_PER_PAGE) + 1) * DAYS_PER_PAGE : DAYS_PER_PAGE;
  });
  const dates = useMemo(() => nextDays(start, dayCount), [start, dayCount]);
  const [slotsByDate, setSlotsByDate] = useState(null); // null while loading
  const [chosenDate, setChosenDate] = useState(initial.date ?? null);
  const [chosenPartySize, setChosenPartySize] = useState(initial.partySize ?? 1);
  const [slotId, setSlotId] = useState(initial.slotId ?? null);
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
    return loaded;
  }, []);

  useEffect(() => {
    getSlots().then(
      (slots) => setSlotsByDate(byDate(slots)),
      () => {
        // Without the slots every day counts as a day with no slots.
        setSlotsByDate({});
        setAlert(GENERIC_ERROR);
      },
    );
  }, []);

  const showMoreDays = useCallback(() => setDayCount((count) => count + DAYS_PER_PAGE), []);

  const days = dates.map((date) => ({ date, hasSlots: slotsByDate ? Boolean(slotsByDate[date]?.length) : undefined }));

  // Until the hiker picks a day, the first day with a time still open is chosen.
  const hasOpenSlot = (day) => (slotsByDate?.[day] ?? []).some((s) => slotAvailability(s, day, 1, now).bookable);
  const date = (chosenDate && dates.includes(chosenDate) ? chosenDate : null)
    ?? dates.find(hasOpenSlot)
    ?? days.find((day) => day.hasSlots)?.date
    ?? null;

  const daySlots = useMemo(() => (date && slotsByDate?.[date]) || [], [date, slotsByDate]);
  const maxPartySize = largestParty(daySlots, date, now);
  const partySize = Math.min(chosenPartySize, maxPartySize);

  const slots = daySlots.map((s) => ({ ...s, ...slotAvailability(s, date, partySize, now) }));
  // While the check dialog is open the slot stays chosen even if the clock closes it: the server
  // answers the confirm, and the dialog does not go blank under the hiker.
  const slot = slots.find((s) => s.slotId === slotId && (s.bookable || isReviewing)) ?? null;

  const chooseDate = (next) => {
    setChosenDate(next);
    setSlotId(null);
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
      setAlert(`Booking for ${formatTime(failed.startsAt)} closed at ${formatClosingTime(date, failed.startsAt)}. Choose another time.`);
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
    date,
    chooseDate,
    partySize,
    maxPartySize,
    setPartySize: (n) => setChosenPartySize(Math.max(1, Math.min(n, maxPartySize))),
    slots,
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
