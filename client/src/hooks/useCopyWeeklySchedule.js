import { useCallback, useEffect, useMemo, useState } from 'react';
import { copyWeeklySchedule, getStaffPeriodSummaries } from '../api/staff.js';
import { daysBetween, nextDays } from '../lib/bookingDates.js';

const INITIAL_DESTINATION_WEEKS = 4;
const GENERIC_ERROR = 'Something went wrong on our side. Try again in a minute.';
const STAFF_ONLY = 'Only the staff can see and change the slots and tables.';

const destinationIntervals = (periods) => periods.reduce((intervals, period) => {
  const previous = intervals[intervals.length - 1];
  if (previous && daysBetween(previous.to, period.from) === 1) {
    previous.to = period.to;
    return intervals;
  }
  return [...intervals, { from: period.from, to: period.to }];
}, []);

export function useCopyWeeklySchedule({ sourceStart, onNeedsLogin, enabled = true }) {
  const [periods, setPeriods] = useState(null);
  const [visibleDestinationWeeks, setVisibleDestinationWeeks] = useState(INITIAL_DESTINATION_WEEKS);
  const [selected, setSelected] = useState([]);
  const [alert, setAlert] = useState(null);
  const [isPending, setIsPending] = useState(false);

  const requestPeriods = useCallback(async (destinationWeeks) => {
    const dates = nextDays(sourceStart, (destinationWeeks + 1) * 7);
    return getStaffPeriodSummaries(sourceStart, dates[dates.length - 1]);
  }, [sourceStart]);

  useEffect(() => {
    if (!enabled) return undefined;
    let current = true;
    requestPeriods(visibleDestinationWeeks).then(
      (answer) => current && setPeriods(answer),
      (error) => {
        if (!current) return;
        if (error.status === 401) onNeedsLogin();
        else setAlert(error.status === 403 ? STAFF_ONLY : GENERIC_ERROR);
      },
    );
    return () => {
      current = false;
    };
  }, [enabled, onNeedsLogin, requestPeriods, visibleDestinationWeeks]);

  const destinations = useMemo(() => periods?.slice(1) ?? [], [periods]);
  const selectedPeriods = useMemo(
    () => destinations.filter((period) => selected.includes(period.from)),
    [destinations, selected],
  );
  const replacedSlots = selectedPeriods.reduce((sum, period) => sum + period.slotCount, 0);

  const toggle = useCallback((period) => {
    if (!period.canReplace) return;
    setAlert(null);
    setSelected((current) => current.includes(period.from)
      ? current.filter((from) => from !== period.from)
      : [...current, period.from]);
  }, []);

  const showMore = useCallback(() => {
    setVisibleDestinationWeeks((count) => count + INITIAL_DESTINATION_WEEKS);
  }, []);

  const reset = useCallback(() => {
    setPeriods(null);
    setVisibleDestinationWeeks(INITIAL_DESTINATION_WEEKS);
    setSelected([]);
    setAlert(null);
  }, []);

  const copy = useCallback(async () => {
    setIsPending(true);
    setAlert(null);
    try {
      const result = await copyWeeklySchedule({
        sourceStart,
        destinationIntervals: destinationIntervals(selectedPeriods),
      });
      return { ok: true, result };
    } catch (error) {
      if (error.status === 409) {
        try {
          const refreshed = await requestPeriods(visibleDestinationWeeks);
          setPeriods(refreshed);
          const replaceable = new Set(refreshed.filter((period) => period.canReplace).map((period) => period.from));
          setSelected((current) => current.filter((from) => replaceable.has(from)));
        } catch (reloadError) {
          if (reloadError.status === 401) onNeedsLogin();
        }
        setAlert('A selected continuation period now has a booking. Nothing was copied.');
      } else if (error.status === 400) {
        setAlert(error.message);
      } else if (error.status === 401) {
        onNeedsLogin();
      } else {
        setAlert(error.status === 403 ? STAFF_ONLY : GENERIC_ERROR);
      }
      return { ok: false };
    } finally {
      setIsPending(false);
    }
  }, [onNeedsLogin, requestPeriods, selectedPeriods, sourceStart, visibleDestinationWeeks]);

  return {
    periods,
    destinations,
    selected,
    selectedPeriods,
    replacedSlots,
    alert,
    isPending,
    toggle,
    showMore,
    reset,
    copy,
  };
}
