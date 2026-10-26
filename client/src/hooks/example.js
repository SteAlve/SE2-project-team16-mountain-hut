/**
 * HOOKS: here go the state and data logic of the screens (calls to api/, loading, errors).
 * Not here: JSX, markup, fetch.
 *
 * THE CODE BELOW IS JUST AN EXAMPLE (story MH-01).
 * Delete this file when the first real one exists.
 */
import { useState } from 'react';
import { bookTable } from '../api/bookings.js';

export function useBookTable() {
  const [state, setState] = useState({ booking: null, error: null });

  const book = (query) =>
    bookTable(query).then(
      (booking) => setState({ booking, error: null }),
      (error) => setState({ booking: null, error }),
    );

  return { ...state, book };
}
