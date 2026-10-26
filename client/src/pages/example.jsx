/**
 * PAGES: here goes one screen per route. A page calls hooks and puts components on the screen.
 * Not here: fetch, api/.
 *
 * THE CODE BELOW IS JUST AN EXAMPLE (story MH-01).
 * Delete this file when the first real one exists.
 */
import { useBookTable } from '../hooks/useBookTable.js';

export function BookTablePage() {
  const { booking, error, book } = useBookTable();

  return (
    <main>
      <button type="button" onClick={() => book({ slotId: 1, partySize: 2 })}>Book</button>
      {booking && <p>Booked: {booking.id}</p>}
      {error && <p role="alert">{error.message}</p>}
    </main>
  );
}
