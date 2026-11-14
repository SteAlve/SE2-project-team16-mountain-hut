/**
 * HOOKS: the "Change your booking" dialog (story MH-06, mockup docs/mockups/hiker-booking-page, screens 3-9).
 * It starts from the saved booking and keeps the new choices until Save changes; nothing is sent before.
 *
 *   days, showMoreDays()    the day strip: the days with a time at least 48 hours away (and the day of the booking)
 *   date, chooseDate(day)   the chosen day; the time of the day is kept when the new day has it
 *   partySize, setPartySize(n)
 *   slots                   [{ slotId, startsAt, endsAt, selectable, label }] of the chosen day, only the times
 *                           that start at least 48 hours from now (the server checks it again)
 *   slot, chooseSlot(id)    the chosen slot, or null
 *   needs                   the dietary needs (hooks/useDietaryNeeds), filled with the saved ones
 *   changes                 what would be sent: only what differs from the booking
 *   hasChanges, needsOnly   something changed; only the dietary needs changed (no seat check)
 *   canSave, isPending, alert
 *   save()                  sends the change; resolves to 'saved', 'login' (401) or 'failed'
 *
 * The seats a time shows are the free seats of the server; in the slot of the booking the seats of the
 * booking itself count as free, as they do when the server seats the party again. A time with seats
 * too few for the party stays pickable: the server has no preview for a change, Save changes answers.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { changeBooking } from '../api/bookings.js';
import { getSlots } from '../api/slots.js';
import { daysBetween, nextDays } from '../lib/bookingDates.js';
import {
  buildChanges,
  changeFailure,
  isNeedsOnly,
  startsAfterNotice,
  stripStart,
} from '../lib/changeBooking.js';
import { seats } from '../lib/slotAvailability.js';
import { useDietaryNeeds } from './useDietaryNeeds.js';

const DAYS_PER_PAGE = 14;
const TICK_MS = 30 * 1000;

const byDate = (slots) =>
  slots.reduce((days, slot) => ({ ...days, [slot.date]: [...(days[slot.date] ?? []), slot] }), {});

// `onSaved(booking)` after a saved change; `onStale()` when the answer says the booking on screen is out of date.
export function useChangeBooking(booking, { onSaved, onStale }) {
  const [now, setNow] = useState(() => new Date());
  const [start] = useState(() => stripStart(booking.date, new Date()));
  const [dayCount, setDayCount] = useState(() => Math.max(DAYS_PER_PAGE, daysBetween(start, booking.date) + 7));
  const [slotsByDate, setSlotsByDate] = useState(null); // null while loading
  const [chosenDate, setChosenDate] = useState(booking.date);
  const [chosenSlotId, setChosenSlotId] = useState(booking.slotId);
  // The time of day the hiker had, kept when the day changes.
  const [chosenStart, setChosenStart] = useState(booking.startsAt);
  const [partySize, setChosenPartySize] = useState(booking.partySize);
  const [isPending, setIsPending] = useState(false);
  const [alert, setAlert] = useState(null);
  const needs = useDietaryNeeds(partySize, booking.requirements);

  const loadSlots = useCallback(async () => setSlotsByDate(byDate(await getSlots())), []);

  useEffect(() => {
    let active = true;
    getSlots().then(
      (slots) => { if (active) setSlotsByDate(byDate(slots)); },
      () => { if (active) setSlotsByDate({}); },
    );
    return () => { active = false; };
  }, []);

  // The 48 hours move with the clock: the times are checked again every 30 seconds, but not while saving.
  useEffect(() => {
    if (isPending) return undefined;
    const timer = setInterval(() => {
      setNow(new Date());
      loadSlots().catch(() => {});
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [loadSlots, isPending]);

  // The times of a day the hiker can choose: 48 hours from now, and always the time of the booking itself.
  const slotsOf = useCallback(
    (day) =>
      (slotsByDate?.[day] ?? [])
        .filter((s) => s.slotId === booking.slotId || startsAfterNotice(s.date, s.startsAt, now))
        .map((s) => {
          const free = s.freeSeats + (s.slotId === booking.slotId ? booking.partySize : 0);
          return {
            slotId: s.slotId,
            startsAt: s.startsAt,
            endsAt: s.endsAt,
            // Nothing fits in a full time, whatever the party; with some seats the server decides.
            bookable: free > 0,
            label: free > 0 ? `${seats(free)} free` : 'Full',
          };
        }),
    [slotsByDate, now, booking.slotId, booking.partySize],
  );

  const dates = useMemo(() => nextDays(new Date(`${start}T12:00:00`), dayCount), [start, dayCount]);
  const days = dates.map((date) => ({ date, hasSlots: slotsByDate ? slotsOf(date).length > 0 : undefined }));
  const slots = slotsOf(chosenDate);
  const slot = slots.find((s) => s.slotId === chosenSlotId) ?? null;

  const chooseDate = (day) => {
    setChosenDate(day);
    setAlert(null);
    const same = slotsOf(day).find((s) => s.startsAt === chosenStart && s.bookable);
    setChosenSlotId(same?.slotId ?? null);
  };
  const chooseSlot = (slotId) => {
    setAlert(null);
    setChosenSlotId(slotId);
    setChosenStart(slots.find((s) => s.slotId === slotId)?.startsAt ?? chosenStart);
  };

  const changes = buildChanges(booking, {
    slotId: slot?.slotId ?? booking.slotId,
    partySize,
    requirements: needs.requirements,
  });
  const hasChanges = Object.keys(changes).length > 0;
  const canSave = Boolean(slot) && hasChanges && !isPending;

  const save = async () => {
    if (!canSave) return 'failed';
    // A line that cannot be sent stays open, with the problem marked.
    if (!needs.check()) return 'failed';
    setIsPending(true);
    setAlert(null);
    try {
      const saved = await changeBooking(booking.id, changes);
      onSaved(saved);
      return 'saved';
    } catch (error) {
      if (error.status === 401) return 'login';
      setAlert(changeFailure(error, { slot, partySize }));
      // The booking on screen may be out of date (changed elsewhere, deadline passed, gone): load it again.
      if (error.status === 404 || error.status === 422 || error.code === 'BOOKING_CHANGED') onStale();
      return 'failed';
    } finally {
      setIsPending(false);
    }
  };

  return {
    days,
    showMoreDays: () => setDayCount((count) => count + DAYS_PER_PAGE),
    date: chosenDate,
    chooseDate,
    partySize,
    setPartySize: (n) => { setAlert(null); setChosenPartySize(Math.max(1, n)); },
    isLoading: slotsByDate === null,
    slots,
    slot,
    chooseSlot,
    needs,
    changes,
    hasChanges,
    needsOnly: isNeedsOnly(changes),
    canSave,
    isPending,
    alert,
    now,
    save,
  };
}
