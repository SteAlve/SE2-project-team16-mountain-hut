/**
 * The seats of one booking, shown as one party (Figma "Party seats", PO #11). When the party is
 * split, the groups sit in one bar so the hiker sees one booking, not separate bookings.
 * `tables` is [{ name, seatCount }] when the server says where the party sits; without it the
 * whole party is one group and the tables are "chosen for you".
 */
import styles from './PartySeats.module.css';

const tableWord = (n) => `${n} ${n === 1 ? 'table' : 'tables'}`;

export function PartySeats({ partySize, tables }) {
  const groups = tables?.length ? tables.map((t) => t.seatCount) : [partySize];
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <p className={styles.title}>{partySize} seats for your party</p>
        {tables?.length > 0 && <span className={styles.chip}>{tableWord(tables.length)}</span>}
      </div>
      <div className={styles.seats} aria-hidden="true">
        {groups.map((count, i) => (
          <span key={i} className={styles.group}>
            {Array.from({ length: count }, (_, j) => <span key={j} className={styles.seat} />)}
          </span>
        ))}
      </div>
      <p className={styles.detail}>
        {tables?.length
          ? tables.map((t) => `${t.seatCount} at table ${t.name}`).join(' · ')
          : 'Tables chosen for you when you confirm'}
      </p>
    </div>
  );
}
