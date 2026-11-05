/**
 * HOOKS: the "Slots & tables" page (story MH-02, mockup docs/mockups/slots).
 * Loads the table sets and the slots of the days in the strip, and saves slots and table sets.
 * The answers of the server become the texts of the mockup ("Texts and server answers").
 *
 *   days                     [{ date, hasSlots }] the day strip, from today; hasSlots is undefined
 *                            while loading. Every day can be picked
 *   showMoreDays()           adds the next days to the strip (it has no end)
 *   date, chooseDate(day)    the chosen day, today at start
 *   slots                    the StaffSlot of the chosen day, in order of time; null while loading
 *   totalSeats               the seats of the chosen day
 *   tableSets                every TableSet, in the order of the server
 *   addSlot(form)            { date, startsAt, endsAt, tableSetId|null } -> { ok } or { ok: false,
 *                            alert?, errors? } (errors: the message of each field)
 *   createTableSet(form)     { name, tables } -> { ok, tableSet } or { ok: false, alert?, errors? }
 *   assignTableSet(id, set)  gives a table set to a slot without tables -> { ok } or { ok: false };
 *                            a failure is said by `alert`
 *   isPending                true while saving
 *   alert                    the message on top of the page, or null
 *   notice                   an information on top of the page (a slot added on a past day), or null
 *   needsLogin               true once the server answered 401: the page sends to the login
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  assignTableSet as putTableSet,
  createSlot,
  createTableSet as postTableSet,
  getStaffSlots,
  getTableSets,
} from '../api/staff.js';
import { daysBetween, formatDay, formatLongDay, nextDays } from '../lib/bookingDates.js';
import { byStart } from '../lib/tableSets.js';

const DAYS_PER_PAGE = 14;
const GENERIC_ERROR = 'Something went wrong on our side. Try again in a minute.';
const STAFF_ONLY = 'Only the staff can see and change the slots and tables.';
const GONE = 'That slot or table set no longer exists.';

export function useSlotsTables() {
  const [start] = useState(() => new Date());
  const [dayCount, setDayCount] = useState(DAYS_PER_PAGE);
  const dates = useMemo(() => nextDays(start, dayCount), [start, dayCount]);
  const from = dates[0];
  const to = dates[dates.length - 1];
  // { to, slots }: the slots from today to `to`; null until the first answer.
  const [loaded, setLoaded] = useState(null);
  const [tableSets, setTableSets] = useState([]);
  const [date, setDate] = useState(from);
  const [isPending, setIsPending] = useState(false);
  const [alert, setAlert] = useState(null);
  const [notice, setNotice] = useState(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  // What every call does with 401, 403 and the failures nobody expects. Returns the message to show.
  const commonFailure = useCallback((error) => {
    if (error.status === 401) {
      setNeedsLogin(true);
      return null;
    }
    return error.status === 403 ? STAFF_ONLY : GENERIC_ERROR;
  }, []);

  // Bumped after every save (and after a conflict) to read the data again. The read still on its
  // way is dropped: it may have left the server before the save, and would hide what was saved.
  const [slotsVersion, setSlotsVersion] = useState(0);
  const [tableSetsVersion, setTableSetsVersion] = useState(0);
  const reloadSlots = () => setSlotsVersion((v) => v + 1);
  const reloadTableSets = () => setTableSetsVersion((v) => v + 1);

  // A longer strip loads the whole range again: the days already there keep their slots meanwhile.
  useEffect(() => {
    let current = true;
    getStaffSlots(from, to).then(
      (slots) => current && setLoaded({ to, slots }),
      (error) => current && setAlert(commonFailure(error)),
    );
    return () => {
      current = false;
    };
  }, [from, to, slotsVersion, commonFailure]);

  useEffect(() => {
    let current = true;
    getTableSets().then(
      (sets) => current && setTableSets(sets),
      (error) => current && setAlert(commonFailure(error)),
    );
    return () => {
      current = false;
    };
  }, [tableSetsVersion, commonFailure]);

  const showMoreDays = useCallback(() => setDayCount((count) => count + DAYS_PER_PAGE), []);

  const isLoaded = (day) => loaded !== null && day <= loaded.to;
  const days = dates.map((day) => ({
    date: day,
    hasSlots: isLoaded(day) ? loaded.slots.some((s) => s.date === day) : undefined,
  }));
  const daySlots = isLoaded(date) ? loaded.slots.filter((s) => s.date === date).sort(byStart) : null;

  const chooseDate = (day) => {
    setDate(day);
    setAlert(null);
    setNotice(null);
  };

  // After a slot is saved on `day`: a later day is added to the strip and chosen; a past day is not
  // in the strip, so the page says where the slot went.
  const showDay = (day) => {
    const ahead = daysBetween(from, day);
    if (ahead < 0) {
      setNotice(`The slot was added on ${formatLongDay(day)}, before today.`);
      return;
    }
    if (ahead >= dayCount) setDayCount((Math.floor(ahead / DAYS_PER_PAGE) + 1) * DAYS_PER_PAGE);
    chooseDate(day);
  };

  // Every save disables its button until the server answers.
  const run = async (action) => {
    setIsPending(true);
    try {
      return await action();
    } finally {
      setIsPending(false);
    }
  };

  const addSlot = (form) =>
    run(async () => {
      try {
        const slot = await createSlot(form);
        setLoaded((current) => current && { ...current, slots: [...current.slots, slot] });
        reloadSlots();
        showDay(slot.date);
        return { ok: true, slot };
      } catch (error) {
        if (error.status === 409) {
          // The mockup reloads the day and keeps the other choices.
          reloadSlots();
          if (daysBetween(from, form.date) >= 0) showDay(form.date);
          return {
            ok: false,
            alert: `A slot starting at ${form.startsAt} already exists on ${formatDay(form.date)}. The day was reloaded: choose another start time.`,
            errors: { startsAt: 'Already used.' },
          };
        }
        if (error.status === 404) {
          reloadTableSets();
          return { ok: false, alert: `${GONE} Choose another table set.` };
        }
        if (error.status === 400) return { ok: false, alert: error.message };
        return { ok: false, alert: commonFailure(error) };
      }
    });

  const createTableSet = ({ name, tables }) =>
    run(async () => {
      try {
        const tableSet = await postTableSet({ name: name.trim(), tables });
        setTableSets((list) => [...list, tableSet]);
        reloadTableSets();
        return { ok: true, tableSet };
      } catch (error) {
        if (error.status === 409) {
          return { ok: false, errors: { name: 'A table set with this name already exists. Choose another name.' } };
        }
        if (error.status === 400) return { ok: false, alert: error.message };
        return { ok: false, alert: commonFailure(error) };
      }
    });

  const assignTableSet = (slotId, tableSetId) =>
    run(async () => {
      try {
        const slot = await putTableSet(slotId, tableSetId);
        setLoaded((current) => current && {
          ...current,
          slots: current.slots.map((s) => (s.slotId === slotId ? slot : s)),
        });
        reloadSlots();
        setAlert(null);
        return { ok: true };
      } catch (error) {
        if (error.status === 409 || error.status === 404) {
          // A colleague gave the slot its tables meanwhile, or something was deleted: reload the day.
          reloadSlots();
          reloadTableSets();
          setAlert(error.status === 409 ? 'This slot already has its tables.' : GONE);
        } else {
          setAlert(commonFailure(error));
        }
        return { ok: false };
      }
    });

  return {
    days,
    showMoreDays,
    date,
    chooseDate,
    slots: daySlots,
    totalSeats: (daySlots ?? []).reduce((sum, s) => sum + s.totalSeats, 0),
    tableSets,
    addSlot,
    createTableSet,
    assignTableSet,
    isPending,
    alert,
    notice,
    needsLogin,
  };
}
