/**
 * HOOKS: the "Slots & tables" page (story MH-02, mockup docs/mockups/slots).
 * For now it works on sample data in memory (lib/slotsMockData.js), with a short wait to show the
 * pending states: nothing is sent to the server yet. The answers it gives (409 on the same start
 * time or the same set name) are the ones of the mockup, so the page does not change when the
 * real calls replace `later`.
 *
 *   days                     [{ date, hasSlots }] the day strip, from today; every day can be picked
 *   showMoreDays()           adds the next days to the strip (it has no end)
 *   date, chooseDate(day)    the chosen day, today at start
 *   slots                    the StaffSlot of the chosen day, in order of time
 *   totalSeats               the seats of the chosen day
 *   tableSets                every TableSet, in the order they were made
 *   addSlot(form)            { date, startsAt, endsAt, tableSetId|null } -> { ok } or { ok: false,
 *                            alert?, errors? } (errors: the message of each field)
 *   createTableSet(form)     { name, tables } -> { ok, tableSet } or { ok: false, errors }
 *   assignTableSet(id, set)  gives a table set to a slot without tables -> { ok } or { ok: false }
 *   isPending                true while "saving"
 *   alert, clearAlert()      the message on top of the page, or null
 */
import { useCallback, useMemo, useState } from 'react';
import { formatDay, nextDays, toDay } from '../lib/bookingDates.js';
import { MOCK_SLOTS, MOCK_TABLE_SETS } from '../lib/slotsMockData.js';
import { byStart, totalSeats } from '../lib/tableSets.js';

const DAYS_PER_PAGE = 14;
const DELAY_MS = 500;

// Stands for the server while the page is not wired to it.
const later = (value) => new Promise((resolve) => setTimeout(() => resolve(value), DELAY_MS));

export function useSlotsTables() {
  const [start] = useState(() => new Date());
  const [dayCount, setDayCount] = useState(DAYS_PER_PAGE);
  const dates = useMemo(() => nextDays(start, dayCount), [start, dayCount]);
  const [slots, setSlots] = useState(MOCK_SLOTS);
  const [tableSets, setTableSets] = useState(MOCK_TABLE_SETS);
  const [date, setDate] = useState(() => toDay(start));
  const [isPending, setIsPending] = useState(false);
  const [alert, setAlert] = useState(null);

  const showMoreDays = useCallback(() => setDayCount((count) => count + DAYS_PER_PAGE), []);

  const days = dates.map((day) => ({ date: day, hasSlots: slots.some((s) => s.date === day) }));
  const daySlots = slots.filter((s) => s.date === date).sort(byStart);

  const chooseDate = (day) => {
    setDate(day);
    setAlert(null);
  };

  // Every action waits like a request would, with the save button disabled meanwhile.
  const run = async (action) => {
    setIsPending(true);
    try {
      return await action();
    } finally {
      setIsPending(false);
    }
  };

  const addSlot = ({ date: day, startsAt, endsAt, tableSetId }) =>
    run(async () => {
      await later();
      if (slots.some((s) => s.date === day && s.startsAt === startsAt)) {
        // 409: the mockup reloads the day and keeps the other choices.
        setDate(day);
        return {
          ok: false,
          alert: `A slot starting at ${startsAt} already exists on ${formatDay(day)}. The day was reloaded: choose another start time.`,
          errors: { startsAt: 'Already used.' },
        };
      }
      const tableSet = tableSets.find((set) => set.tableSetId === tableSetId) ?? null;
      const slot = {
        slotId: Math.max(0, ...slots.map((s) => s.slotId)) + 1,
        date: day,
        startsAt,
        endsAt,
        tableSet,
        totalSeats: tableSet?.totalSeats ?? 0,
      };
      setSlots((list) => [...list, slot]);
      setDate(day);
      setAlert(null);
      return { ok: true, slot };
    });

  const createTableSet = ({ name, tables }) =>
    run(async () => {
      await later();
      const trimmed = name.trim();
      if (tableSets.some((set) => set.name.toLowerCase() === trimmed.toLowerCase())) {
        return { ok: false, errors: { name: 'A table set with this name already exists. Choose another name.' } };
      }
      const tableSet = {
        tableSetId: Math.max(0, ...tableSets.map((set) => set.tableSetId)) + 1,
        name: trimmed,
        tables: tables.map((t) => ({ tableNumber: Number(t.tableNumber), capacity: Number(t.capacity) })),
        totalSeats: totalSeats(tables.map((t) => ({ capacity: Number(t.capacity) }))),
      };
      setTableSets((list) => [...list, tableSet]);
      return { ok: true, tableSet };
    });

  const assignTableSet = (slotId, tableSetId) =>
    run(async () => {
      await later();
      const tableSet = tableSets.find((set) => set.tableSetId === tableSetId);
      const slot = slots.find((s) => s.slotId === slotId);
      if (!slot || !tableSet) {
        setAlert('That slot or table set no longer exists.');
        return { ok: false };
      }
      if (slot.tableSet) {
        setAlert('This slot already has its tables.');
        return { ok: false };
      }
      setSlots((list) =>
        list.map((s) => (s.slotId === slotId ? { ...s, tableSet, totalSeats: tableSet.totalSeats } : s)),
      );
      return { ok: true };
    });

  return {
    days,
    showMoreDays,
    date,
    chooseDate,
    slots: daySlots,
    totalSeats: daySlots.reduce((sum, s) => sum + s.totalSeats, 0),
    tableSets,
    addSlot,
    createTableSet,
    assignTableSet,
    isPending,
    alert,
    clearAlert: () => setAlert(null),
  };
}
