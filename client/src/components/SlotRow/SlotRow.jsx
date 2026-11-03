/**
 * A slot of the day on the staff page (Figma "Slot row"): its time, its table set with the tables,
 * and its total seats. A slot without tables is dashed, has 0 seats in red and the Choose tables
 * button (`onChooseTables`). `slot` is a StaffSlot of docs/openapi.json.
 */
import { formatTimeRange } from '../../lib/bookingDates.js';
import { durationLabel } from '../../lib/tableSets.js';
import { Button } from '../Button/Button.jsx';
import { TableChips } from '../TableChips/TableChips.jsx';
import styles from './SlotRow.module.css';

export function SlotRow({ slot, onChooseTables }) {
  const { startsAt, endsAt, tableSet, totalSeats } = slot;
  const range = formatTimeRange(startsAt, endsAt);

  return (
    <li className={`${styles.row} ${tableSet ? '' : styles.noTables}`}>
      <div className={styles.when}>
        <span className={styles.time}>{range}</span>
        <span className={styles.duration}>{durationLabel(startsAt, endsAt)}</span>
      </div>

      <div className={styles.tables}>
        {tableSet ? (
          <>
            <span className={styles.setName}>{tableSet.name}</span>
            <TableChips tables={tableSet.tables} />
          </>
        ) : (
          <>
            <span className={styles.missing}>No tables yet</span>
            <span className={styles.note}>0 seats: hikers cannot book this time.</span>
          </>
        )}
      </div>

      {!tableSet && (
        <Button variant="outline" size="small" className={styles.choose} onClick={onChooseTables}>
          Choose tables
        </Button>
      )}

      <div className={styles.seats}>
        <span className={styles.total}>{totalSeats}</span>
        <span className={styles.unit}>seats</span>
      </div>
    </li>
  );
}
