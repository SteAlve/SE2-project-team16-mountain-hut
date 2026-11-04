// MH-04 seating preview; stale requests cannot replace the answer for the current choices.
import { useCallback, useEffect, useState } from 'react';
import { getSeating, getSlots } from '../api/slots.js';

export function usePublicAvailability(slot, partySize, onSlotsRefreshed) {
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const slotId = slot?.slotId;
  const freeSeats = slot?.freeSeats;
  const bookable = slot?.bookable;
  const label = slot?.label;
  const key = `${slotId}:${partySize}:${freeSeats}:${bookable}:${attempt}`;
  useEffect(() => {
    if (!slotId) return;
    let active = true;
    getSeating(slotId, partySize).then(
      async ({ tables }) => {
        const latestSlots = await getSlots().catch(() => null);
        if (active) {
          if (latestSlots) onSlotsRefreshed(latestSlots);
          setResult({ key, status: 'available', tables });
        }
      },
      async (error) => {
        const unavailable = [404, 409, 422].includes(error.status);
        const latestSlots = unavailable ? await getSlots().catch(() => null) : null;
        const latest = latestSlots?.find((s) => s.slotId === slotId);
        if (active) {
          if (latestSlots) onSlotsRefreshed(latestSlots);
          setResult({ key, status: unavailable ? 'unavailable' : 'error', error, latest });
        }
      },
    );
    return () => { active = false; };
  }, [slotId, partySize, bookable, key, onSlotsRefreshed]);
  if (!slotId) return null;
  return result?.key === key ? { ...result, freeSeats: result.latest?.freeSeats ?? freeSeats, label, retry } : { status: 'loading' };
}
