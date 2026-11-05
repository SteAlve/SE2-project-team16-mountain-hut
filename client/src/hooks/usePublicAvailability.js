// MH-04 seating preview; stale requests cannot replace the answer for the current choices.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSeating, getSlots } from '../api/slots.js';
import { availabilityResult } from '../lib/availabilityResult.js';

export function usePublicAvailability(slot, partySize, onSlotsRefreshed) {
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const previousQuery = useRef(null);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const slotId = slot?.slotId;
  const freeSeats = slot?.freeSeats;
  const bookable = slot?.bookable;
  const label = slot?.label;
  const key = `${slotId}:${partySize}:${attempt}`;
  const revision = `${freeSeats}:${bookable}`;
  useEffect(() => {
    if (!slotId) return;
    let active = true;
    // Polling already fetched the slot list. Only a new selection/retry needs a follow-up list.
    const refreshSlots = previousQuery.current !== key;
    previousQuery.current = key;
    getSeating(slotId, partySize).then(
      async ({ tables }) => {
        if (!active) return;
        const latestSlots = refreshSlots ? await getSlots().catch(() => null) : null;
        if (active) {
          if (latestSlots) onSlotsRefreshed(latestSlots);
          setResult({ key, revision, status: 'available', tables });
        }
      },
      async (error) => {
        if (!active) return;
        const unavailable = [404, 409, 422].includes(error.status);
        const latestSlots = unavailable && refreshSlots ? await getSlots().catch(() => null) : null;
        const latest = latestSlots?.find((s) => s.slotId === slotId);
        if (active) {
          if (latestSlots) onSlotsRefreshed(latestSlots);
          setResult({ key, revision, status: unavailable ? 'unavailable' : 'error', error, latest });
        }
      },
    );
    return () => { active = false; };
  }, [slotId, partySize, revision, key, onSlotsRefreshed]);
  if (!slotId) return null;
  return availabilityResult(result, key, revision, {
    freeSeats: result?.revision === revision ? result.latest?.freeSeats ?? freeSeats : freeSeats,
    label,
    retry,
  });
}
