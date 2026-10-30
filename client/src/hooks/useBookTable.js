/**
 * HOOKS: the "Book a table" page (story MH-01, mockup docs/mockups/booking).
 * Loads the slots of the next days, keeps the hiker's choices and books.
 *
 *   days                   [{ date, hasSlots }] the day strip; hasSlots is undefined while loading
 *   showMoreDays()         adds the next days to the strip (it has no end), and loads their slots
 *   date, partySize        the chosen day and party size; maxPartySize is the top of the stepper
 *   slots                  [{ slotId, startsAt, endsAt, freeSeats, bookable, label }] of the chosen day
 *   slot                   the chosen slot, or null (a slot that stops fitting is not chosen any more)
 *   now                    the current time, updated every 30 seconds
 *   isReviewing            true while the check dialog is open; review() opens it, back() closes it
 *   confirm()              books; resolves to 'booked', 'login' (401: log in first) or 'failed'
 *   isPending              true while waiting for the server
 *   alert                  the message of the last failure, or null
 *   booking                the saved booking { id, date, partySize, slot }, or null
 *   startOver()            forgets the booking to book another table
 *
 * `initial` ({ date, partySize, slotId }, all optional) restores the choices, e.g. after the login.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createBooking } from '../api/bookings.js';
import { getSlots } from '../api/slots.js';
import { daysBetween, formatClosingTime, formatTime, isClosed, nextDays, toDay } from '../lib/bookingDates.js';
import { largestParty, slotAvailability } from '../lib/slotAvailability.js';

// The strip has no end: it grows by this many days as the hiker scrolls (open question #26).
const DAYS_PER_PAGE = 14;
const TICK_MS = 30 * 1000;
const GENERIC_ERROR = 'Something went wrong on our side. Try again in a minute.';

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function useBookTable(initial = {}) {
  const now = useNow();
  const [start] = useState(() => new Date());
  // A restored day further ahead is already in the strip.
  const [dayCount, setDayCount] = useState(() => {
    const ahead = daysBetween(toDay(start), initial.date);
    return ahead >= 0 ? (Math.floor(ahead / DAYS_PER_PAGE) + 1) * DAYS_PER_PAGE : DAYS_PER_PAGE;
  });
  const dates = useMemo(() => nextDays(start, dayCount), [start, dayCount]);
  const requested = useRef(new Set());
  const [slotsByDate, setSlotsByDate] = useState({});
  const [chosenDate, setChosenDate] = useState(initial.date ?? null);
  const [chosenPartySize, setChosenPartySize] = useState(initial.partySize ?? 1);
  const [slotId, setSlotId] = useState(initial.slotId ?? null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [alert, setAlert] = useState(null);
  const [booking, setBooking] = useState(null);

  const loadDay = useCallback(async (date) => {
    const slots = await getSlots(date);
    setSlotsByDate((current) => ({ ...current, [date]: slots }));
    return slots;
  }, []);

  // Loads only the days just added to the strip.
  useEffect(() => {
    const added = dates.filter((date) => !requested.current.has(date));
    if (added.length === 0) return;
    added.forEach((date) => requested.current.add(date));
    Promise.all(added.map((date) => getSlots(date).catch(() => null))).then((results) => {
      if (results.every((slots) => slots === null)) setAlert(GENERIC_ERROR);
      // A day that failed to load counts as a day with no slots.
      const loaded = Object.fromEntries(added.map((date, i) => [date, results[i] ?? []]));
      setSlotsByDate((current) => ({ ...current, ...loaded }));
    });
  }, [dates]);

  const showMoreDays = useCallback(() => setDayCount((count) => count + DAYS_PER_PAGE), []);

  const days = dates.map((date) => ({ date, hasSlots: slotsByDate[date] && slotsByDate[date].length > 0 }));

  // Until the hiker picks a day, the first day with a time still open is chosen.
  const hasOpenSlot = (day) => (slotsByDate[day] ?? []).some((s) => !isClosed(day, s.startsAt, now));
  const date = (chosenDate && dates.includes(chosenDate) ? chosenDate : null)
    ?? dates.find(hasOpenSlot)
    ?? days.find((day) => day.hasSlots)?.date
    ?? null;

  const daySlots = useMemo(() => (date && slotsByDate[date]) || [], [date, slotsByDate]);
  const maxPartySize = largestParty(daySlots, date, now);
  const partySize = Math.min(chosenPartySize, Math.max(maxPartySize, 1));

  const slots = daySlots.map((s) => ({ ...s, ...slotAvailability(s, date, partySize, now) }));
  const slot = slots.find((s) => s.slotId === slotId && s.bookable) ?? null;

  const chooseDate = (next) => {
    setChosenDate(next);
    setSlotId(null);
  };

  const confirm = async () => {
    if (!slot) return 'failed';
    setIsPending(true);
    setAlert(null);
    try {
      const saved = await createBooking({ date, slotId: slot.slotId, partySize });
      setBooking({ ...saved, slot });
      setIsReviewing(false);
      return 'booked';
    } catch (error) {
      setIsReviewing(false);
      if (error.status === 401) return 'login';
      if (error.status === 409 || error.status === 422) {
        // The seats are gone or the time closed meanwhile: reload, keep the day and the party.
        const fresh = await loadDay(date).catch(() => daySlots);
        const freeSeats = fresh.find((s) => s.slotId === slot.slotId)?.freeSeats ?? 0;
        setSlotId(null);
        setAlert(
          error.status === 409
            ? `Those seats were just taken. ${formatTime(slot.startsAt)} now has ${freeSeats} free seats. Choose another time or fewer people.`
            : `Booking for ${formatTime(slot.startsAt)} closed at ${formatClosingTime(date, slot.startsAt)}. Choose another time.`,
        );
      } else if (error.status === 403) {
        setAlert(error.message);
      } else {
        setAlert(GENERIC_ERROR);
      }
      return 'failed';
    } finally {
      setIsPending(false);
    }
  };

  const startOver = () => {
    setBooking(null);
    setSlotId(null);
    setChosenPartySize(1);
    setAlert(null);
    loadDay(date).catch(() => {});
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
    review: () => slot && setIsReviewing(true),
    back: () => setIsReviewing(false),
    confirm,
    isPending,
    alert,
    booking,
    startOver,
  };
}
