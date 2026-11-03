/**
 * "Table booked" (mockup screens 6 and P5): what was booked and, when the server says it, where
 * the party sits. `booking` is { date, partySize, slot: { startsAt, endsAt }, tables? }, tables
 * as [{ tableNumber, seats }].
 */
import bookedIcon from '../../assets/booking/booked.svg';
import { formatDay, formatTime, yearOf } from '../../lib/bookingDates.js';
import { Button } from '../Button/Button.jsx';
import styles from './BookingTicket.module.css';

const tableNames = (tables) =>
  tables.length === 1
    ? `table ${tables[0].tableNumber}`
    : `tables ${tables.slice(0, -1).map((t) => t.tableNumber).join(', ')} and ${tables.at(-1).tableNumber}`;

export function BookingTicket({ booking, firstName, onHome, onBookAnother }) {
  const { date, partySize, slot, tables } = booking;
  return (
    <section className={styles.ticket} aria-labelledby="ticket-title">
      <div className={styles.head}>
        <img src={bookedIcon} alt="" width="44" height="44" />
        <h1 id="ticket-title" className={styles.title}>Table booked</h1>
        <p className={styles.greeting}>See you at the hut{firstName ? `, ${firstName}` : ''}.</p>
      </div>

      <dl className={styles.details}>
        <div>
          <dt>Day</dt>
          <dd>{formatDay(date)}</dd>
          <dd className={styles.sub}>{yearOf(date)}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{formatTime(slot.startsAt)}</dd>
          <dd className={styles.sub}>until {formatTime(slot.endsAt)}</dd>
        </div>
        <div>
          <dt>People</dt>
          <dd>{partySize}</dd>
          <dd className={styles.sub}>in your party</dd>
        </div>
        {tables?.length > 0 && (
          <div>
            <dt>Seats</dt>
            <dd>{tables.map((t) => t.seats).join(' + ')}</dd>
            <dd className={styles.sub}>{tableNames(tables)}</dd>
          </div>
        )}
      </dl>

      <div className={styles.perforation} aria-hidden="true" />

      <div className={styles.actions}>
        <Button className={styles.action} onClick={onHome}>Back to the hut page</Button>
        <Button variant="outline" size="small" className={styles.action} onClick={onBookAnother}>
          Book another table
        </Button>
      </div>
    </section>
  );
}
