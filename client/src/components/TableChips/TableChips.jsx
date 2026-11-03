/**
 * The tables of a table set as chips (Figma "Table chip"): `T3 · 4` is table 3, with 4 seats.
 * `tables` is [{ tableNumber, capacity }].
 */
import styles from './TableChips.module.css';

export function TableChips({ tables }) {
  return (
    <ul className={styles.chips} aria-label="Tables">
      {tables.map(({ tableNumber, capacity }) => (
        <li key={tableNumber} className={styles.chip}>
          <span className={styles.number}>T{tableNumber}</span>
          <span aria-hidden="true">·</span>
          <span className={styles.seats}>
            {capacity}
            <span className={styles.hidden}> {capacity === 1 ? 'seat' : 'seats'}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
