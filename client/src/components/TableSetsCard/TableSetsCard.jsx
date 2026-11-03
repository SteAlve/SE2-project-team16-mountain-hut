/**
 * The card of the table sets, next to the slots: each set with its tables and seats, and
 * + New table set (`onNew`). `tableSets` is [TableSet] of docs/openapi.json.
 */
import { tablesLabel } from '../../lib/tableSets.js';
import { Button } from '../Button/Button.jsx';
import styles from './TableSetsCard.module.css';

export function TableSetsCard({ tableSets, onNew }) {
  return (
    <aside className={styles.card} aria-labelledby="table-sets-title">
      <h2 id="table-sets-title" className={styles.title}>Table sets</h2>
      <p className={styles.intro}>
        A set is the tables a slot has. Make it once and give it to as many slots as you want.
      </p>
      {tableSets.length > 0 ? (
        <ul className={styles.list}>
          {tableSets.map((set) => (
            <li key={set.tableSetId} className={styles.item}>
              <span className={styles.name}>{set.name}</span>
              <span className={styles.count}>{tablesLabel(set.tables)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>No table sets yet.</p>
      )}
      <Button variant="outline" size="small" block onClick={onNew}>
        + New table set
      </Button>
    </aside>
  );
}
