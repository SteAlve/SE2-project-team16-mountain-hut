// Public landing-page data: days come exclusively from employee-defined slots in the API.
import { useEffect, useState } from 'react';
import { getSlots } from '../api/slots.js';

export function useAvailabilityDays() {
  const [state, setState] = useState({ days: [], isLoading: true, error: null });
  useEffect(() => {
    let active = true;
    getSlots().then(
      (slots) => {
        if (active) setState({ days: [...new Set(slots.map(({ date }) => date))].sort(), isLoading: false, error: null });
      },
      () => {
        if (active) setState({ days: [], isLoading: false, error: 'Unable to load meal times. Please try again.' });
      },
    );
    return () => { active = false; };
  }, []);
  return state;
}
