/**
 * A table set to choose, as a radio card (Figma "Table set option"): its name, its tables and its
 * seats. Without `tableSet` it is the "No tables for now" choice, with 0 seats.
 * `name` groups the radios of one dialog.
 */
import { seatsLabel } from '../../lib/tableSets.js';
import { TableChips } from '../TableChips/TableChips.jsx';
import styles from './TableSetOption.module.css';

export function TableSetOption({ name, tableSet, checked, onChange }) {
  return (
    <label className={`${styles.option} ${checked ? styles.checked : ''}`}>
      <input type="radio" name={name} className={styles.radio} checked={checked} onChange={onChange} />
      <span className={styles.body}>
        <span className={styles.name}>{tableSet ? tableSet.name : 'No tables for now'}</span>
        {tableSet && <TableChips tables={tableSet.tables} />}
      </span>
      <span className={styles.seats}>{seatsLabel(tableSet?.totalSeats ?? 0)}</span>
    </label>
  );
}
