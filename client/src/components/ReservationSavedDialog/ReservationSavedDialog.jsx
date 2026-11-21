/**
 * "Reservation saved" (MH-07, mockup screen 7, phone screen 3): the hiker, the day, the time, the
 * people and the tables the server chose. For a hiker account added on the page (`newAccount`), a
 * blue note says where the password was sent. On a phone the details are one line.
 * `saved` is { hiker, date, slot: { startsAt, endsAt }, partySize, tables: [{ tableNumber, seats }],
 * newAccount }. Done calls `onDone`; "+ New reservation" and Esc call `onNew`.
 */
import { formatDay, formatTime, formatTimeRange, toDay } from '../../lib/bookingDates.js';
import { hikerName } from '../../lib/hikers.js';
import { dayLabel, onDay } from '../../lib/staffSlots.js';
import { Alert } from '../Alert/Alert.jsx';
import { Button } from '../Button/Button.jsx';
import { Modal } from '../Modal/Modal.jsx';
import { TableChips } from '../TableChips/TableChips.jsx';
import { TrailBlaze } from '../TrailBlaze/TrailBlaze.jsx';
import styles from './ReservationSavedDialog.module.css';

const tableNames = (tables) => `${tables.length === 1 ? 'table' : 'tables'} ${tables.map((t) => `T${t.tableNumber}`).join(', ')}`;

export function ReservationSavedDialog({ saved, now, onNew, onDone }) {
  const { hiker, date, slot, partySize, tables, newAccount } = saved;
  const name = hikerName(hiker);
  const range = formatTimeRange(slot.startsAt, slot.endsAt);
  const people = `${partySize} ${partySize === 1 ? 'person' : 'people'}`;
  const shortDay = date === toDay(now) ? `today, ${formatDay(date)}` : formatDay(date);

  return (
    <Modal
      open
      title="Reservation saved"
      titleId="reservation-saved-title"
      mark={<TrailBlaze className={styles.mark} />}
      subtitle={
        <>
          <span className={styles.desktop}>
            {name} now has {newAccount ? 'a hiker account and ' : ''}a table for {partySize}{' '}
            {onDay(date, now)} at {formatTime(slot.startsAt)}.
          </span>
          <span className={styles.phone}>
            {name} · {shortDay} · {range} · {people} · {tableNames(tables)}.
          </span>
        </>
      }
      onCancel={onNew}
      onSubmit={onDone}
      actions={
        <>
          <Button variant="outline" size="small" onClick={onNew}>
            + New reservation
          </Button>
          <Button type="submit" size="small" autoFocus>
            Done
          </Button>
        </>
      }
    >
      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt>Hiker</dt>
          <dd>{name}</dd>
        </div>
        <div className={styles.row}>
          <dt>Day</dt>
          <dd>{dayLabel(date, now)}</dd>
        </div>
        <div className={styles.row}>
          <dt>Time</dt>
          <dd className={styles.mono}>{range}</dd>
        </div>
        <div className={styles.row}>
          <dt>People</dt>
          <dd>{partySize}</dd>
        </div>
        <div className={styles.row}>
          <dt>Tables</dt>
          <dd>
            <TableChips tables={tables.map(({ tableNumber, seats }) => ({ tableNumber, capacity: seats }))} />
          </dd>
        </div>
      </dl>

      {newAccount && hiker.email && (
        <Alert variant="info">
          A password was sent to {hiker.email}. They must change it at their first login.
        </Alert>
      )}
    </Modal>
  );
}
