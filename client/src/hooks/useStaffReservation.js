/**
 * HOOKS: the "New reservation" page of the staff (story MH-07, mockup
 * docs/mockups/reservation-for-a-hiker). An employee or the warden chooses the hiker (found by the
 * search or just added), the day, how many people and a time, and saves the reservation. The
 * answers of the server become the texts of the mockup ("Texts and server answers").
 *
 *   now                    the current time, updated every 30 seconds
 *   days                   [{ date, hasSlots }] the day strip, from today; hasSlots is undefined
 *                          while loading. showMoreDays() adds the next days (it has no end)
 *   date, chooseDate(day)  the chosen day, today at start
 *   partySize              how many people, from 1; setPartySize(n), maxPartySize
 *   slots                  [{ slotId, startsAt, endsAt, freeSeats, bookable, label }] of the chosen
 *                          day; a time that started or cannot fit the party is not bookable
 *   slot, chooseSlot(id)   the chosen time, or null (a time that stops being bookable is not
 *                          chosen any more)
 *   hiker                  the chosen hiker { id, firstName, lastName, email, phone, temporary }, or null
 *   chooseHiker(hiker)     chooses a hiker of the search; changeHiker() goes back to the search
 *   addHiker(form)         "New hiker": { mode, firstName, lastName, email, phone } -> { ok } (the new
 *                          hiker is chosen) or { ok: false, errors?, alert?, owner? }; `owner` is the
 *                          hiker who already has that email (409), to choose instead
 *   save()                 books the tables the server proposes, for the hiker
 *   isPending              true while waiting for the server
 *   alert                  the message of the last failure, or null
 *   saved                  { hiker, date, slot, partySize, tables, newAccount } once saved, or null;
 *                          newAccount: the hiker account was added on this page (a password was emailed)
 *   needsLogin             true once the server answered 401: the page sends to the login
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSlots } from '../api/slots.js';
import { createHiker, createStaffBooking, getStaffSeating, searchHikers } from '../api/staff.js';
import { formatTime, nextDays, toDay } from '../lib/bookingDates.js';
import { hikerName, newHikerBody, ownerOfEmail } from '../lib/hikers.js';
import { seats } from '../lib/slotAvailability.js';
import { hasStarted, onDay, staffSlotAvailability } from '../lib/staffSlots.js';

const DAYS_PER_PAGE = 14;
const TICK_MS = 30 * 1000;
const GENERIC_ERROR = 'Something went wrong on our side. Try again in a minute.';
const STAFF_ONLY = 'Only the staff can enter a reservation for a hiker.';
const STARTED = 'This time has already started. Choose another time.';
// PO clarification #27: no business limit on the party; this only keeps exact integers.
const MAX_PARTY_SIZE = Number.MAX_SAFE_INTEGER;

// { 'YYYY-MM-DD': [slot, ...] }, in the order of the server.
const byDate = (slots) =>
  slots.reduce((days, slot) => ({ ...days, [slot.date]: [...(days[slot.date] ?? []), slot] }), {});

export function useStaffReservation() {
  const [start] = useState(() => new Date());
  const [now, setNow] = useState(start);
  const [dayCount, setDayCount] = useState(DAYS_PER_PAGE);
  const dates = useMemo(() => nextDays(start, dayCount), [start, dayCount]);
  const [slotsByDate, setSlotsByDate] = useState(null); // null while loading
  const [loadError, setLoadError] = useState(false);
  const [hiker, setHiker] = useState(null);
  // The id of the hiker account added on this page, whose password was emailed just now.
  const [newAccountId, setNewAccountId] = useState(null);
  const [date, setDate] = useState(() => toDay(start));
  const [partySize, setPartySize] = useState(1);
  const [slotId, setSlotId] = useState(null);
  const [isPending, setIsPending] = useState(false);
  const [alert, setAlert] = useState(null);
  const [saved, setSaved] = useState(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  // The public list of the slots from today on: it has the free seats of each one.
  const loadSlots = useCallback(async () => {
    const loaded = byDate(await getSlots());
    setSlotsByDate(loaded);
    setLoadError(false);
    return loaded;
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

  // A time starts while the page is open, and other reservations take seats: both are shown.
  useEffect(() => {
    if (saved) return undefined;
    const timer = setInterval(() => {
      setNow(new Date());
      loadSlots().catch(() => {});
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [loadSlots, saved]);

  const showMoreDays = useCallback(() => setDayCount((count) => count + DAYS_PER_PAGE), []);
  const days = dates.map((day) => ({ date: day, hasSlots: slotsByDate ? Boolean(slotsByDate[day]?.length) : undefined }));
  const slots = (slotsByDate?.[date] ?? []).map((s) => ({ ...s, ...staffSlotAvailability(s, date, partySize, now) }));
  // While saving the time stays chosen even if the clock passes its start: the server answers.
  const slot = slots.find((s) => s.slotId === slotId && (s.bookable || isPending)) ?? null;

  // Any new choice answers the last message.
  const choose = (setter) => (value) => {
    setter(value);
    setAlert(null);
  };

  const chooseHiker = choose(setHiker);

  const addHiker = async (form) => {
    setIsPending(true);
    try {
      const created = await createHiker(newHikerBody(form));
      chooseHiker(created);
      if (created.email) setNewAccountId(created.id);
      return { ok: true };
    } catch (error) {
      if (error.status === 401) {
        setNeedsLogin(true);
        return { ok: false };
      }
      if (error.status !== 409) return { ok: false, alert: error.status === 403 ? STAFF_ONLY : GENERIC_ERROR };
      // The 409 does not say whose the email is: a hiker is found by the search, the staff never.
      const owner = await searchHikers(form.email.trim()).then((found) => ownerOfEmail(found, form.email), () => null);
      if (!owner) return { ok: false, errors: { email: 'This email is already in use. Enter another email.' } };
      const name = hikerName(owner);
      return {
        ok: false,
        owner,
        errors: { email: `This email belongs to ${name}, already in the system.` },
        alert: `This hiker may already be in the system. Choose ${name}, or use another email.`,
      };
    } finally {
      setIsPending(false);
    }
  };

  // `step` is 'preview' (where the party would sit) or 'booking'. Every choice is kept unless the
  // time cannot be chosen any more.
  const showFailure = async (error, failed, step) => {
    if (error.status === 401) {
      setNeedsLogin(true);
      return;
    }
    if (![404, 409, 422].includes(error.status)) {
      setAlert(error.status === 403 ? STAFF_ONLY : GENERIC_ERROR);
      return;
    }
    const time = formatTime(failed.startsAt);
    // A 422 of the booking is the time that started or a booking the hiker already has for it. A
    // new preview tells which: it fails only when the time started.
    if (error.status === 422 && step === 'booking') {
      const stillOpen = await getStaffSeating(failed.slotId, partySize).then(() => true, (e) => e.status !== 422);
      if (stillOpen) {
        setAlert(`${hikerName(hiker)} already has a booking at ${time} ${onDay(date, new Date())}. Choose another time.`);
        return;
      }
    }
    // The seats are gone or the time started: the times are loaded again and this one is not chosen.
    const current = new Date();
    setNow(current);
    const fresh = await loadSlots().catch(() => null);
    const latest = fresh?.[date]?.find((s) => s.slotId === failed.slotId);
    if (error.status === 404 && step === 'booking' && latest) {
      setHiker(null);
      setAlert('This hiker is no longer in the system. Find the hiker again.');
      return;
    }
    setSlotId(null);
    if (error.status === 409) {
      setAlert(`Those seats were just taken. ${time} now has ${seats(latest?.freeSeats ?? 0)} free. Choose another time or fewer people.`);
    } else if (error.status === 422 || hasStarted(date, failed.startsAt, current)) {
      // Slots without tables have 0 free seats and cannot be chosen: a 422 here is a time that started.
      setAlert(STARTED);
    } else {
      setAlert(`${time} cannot be booked any more. Choose another time.`);
    }
  };

  const save = async () => {
    if (!hiker || !slot || isPending) return;
    const chosen = slot;
    setIsPending(true);
    setAlert(null);
    let step = 'preview';
    const book = async () => {
      step = 'preview';
      const { tables } = await getStaffSeating(chosen.slotId, partySize);
      step = 'booking';
      return createStaffBooking({ hikerId: hiker.id, slotId: chosen.slotId, partySize, tables });
    };
    try {
      // The employee never sees the tables before saving: if they changed just now, the server's
      // new proposal is booked instead (once).
      const booking = await book().catch((error) => {
        if (error.status === 409 && error.code === 'TABLES_CHANGED') return book();
        throw error;
      });
      setSaved({
        hiker,
        date: booking.date,
        slot: chosen,
        partySize,
        tables: booking.tables,
        newAccount: hiker.id === newAccountId,
      });
      loadSlots().catch(() => {});
    } catch (error) {
      await showFailure(error, chosen, step);
    } finally {
      setIsPending(false);
    }
  };

  return {
    now,
    days,
    showMoreDays,
    date,
    chooseDate: (day) => {
      setDate(day);
      setSlotId(null);
      setAlert(null);
    },
    partySize,
    maxPartySize: MAX_PARTY_SIZE,
    setPartySize: choose((n) => setPartySize(Math.max(1, Math.min(n, MAX_PARTY_SIZE)))),
    slots,
    isLoadingSlots: slotsByDate === null,
    loadError,
    slot,
    chooseSlot: choose(setSlotId),
    hiker,
    chooseHiker,
    changeHiker: () => chooseHiker(null),
    addHiker,
    save,
    isPending,
    alert,
    saved,
    needsLogin,
  };
}
