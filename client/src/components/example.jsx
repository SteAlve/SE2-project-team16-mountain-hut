/**
 * COMPONENTS: here go the reusable pieces of the screens. They draw the props they receive,
 * with their CSS Module next to them.
 * Not here: fetch, api/, hooks/.
 *
 * THE CODE BELOW IS JUST AN EXAMPLE (story MH-04).
 * Delete this file when the first real one exists.
 */
import { formatSeatSplit } from '../lib/formatSeatSplit.js';

export function SeatSplit({ tables }) {
  return <p>Seated as {formatSeatSplit(tables)}.</p>;
}
