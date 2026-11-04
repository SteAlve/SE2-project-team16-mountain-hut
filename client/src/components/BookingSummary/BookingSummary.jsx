/**
 * The summary of the choices of the booking page. It fills in as the hiker chooses and says
 * until when the chosen time can be booked. `BookingSummary` is the card on the right (desktop);
 * `BookingBar` is the bar fixed at the bottom of a phone. The page shows both: CSS picks one.
 * `slot` is the chosen slot or null; without it Review booking is disabled. `isPending` is true
 * while the server says where the party would sit. `canBook` is false for the staff: Review booking
 * stays disabled, because only hikers can book.
 */
import {
  formatBookUntil,
  formatDay,
  formatTime,
  formatTimeRange,
  toDay,
} from '../../lib/bookingDates.js';
import { Button } from '../Button/Button.jsx';
import { AvailabilityAnswer } from '../AvailabilityAnswer/AvailabilityAnswer.jsx';
import { TrailBlaze } from '../TrailBlaze/TrailBlaze.jsx';
import styles from './BookingSummary.module.css';

const dayLabel = (date, now) => (date === toDay(now) ? `Today, ${formatDay(date)}` : formatDay(date));

export function BookingSummary({ date, slot, partySize, now, isPending, canBook = true, onReview, availability, isAvailable = true, searchRange }) {
  return (
    <aside className={styles.card} aria-label="Your booking">
      <h2 className={styles.title}>Your booking</h2>
      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt>Day</dt>
          <dd>{date ? dayLabel(date, now) : <span className={styles.empty}>—</span>}</dd>
        </div>
        <div className={styles.row}>
          <dt>Time</dt>
          <dd className={slot ? styles.mono : ''}>
            {slot ? formatTimeRange(slot.startsAt, slot.endsAt) : searchRange || <span className={styles.empty}>—</span>}
          </dd>
        </div>
        <div className={styles.row}>
          <dt>People</dt>
          <dd>{partySize}</dd>
        </div>
        {!availability && <div className={styles.row}>
          <dt>Tables</dt>
          <dd className={styles.empty}>chosen for you</dd>
        </div>}
      </dl>

      <AvailabilityAnswer answer={availability} partySize={partySize} />
      {canBook && slot && !searchRange && (
        <p className={styles.note}>
          <TrailBlaze className={styles.blaze} />
          <span>
            You can book this time until <strong>{formatBookUntil(date, slot.startsAt, now, slot.bookingClosesAt)}</strong>.
          </span>
        </p>
      )}

      <Button block disabled={!canBook || !slot || !isAvailable || isPending} onClick={onReview}>
        {isPending ? 'Checking…' : 'Review booking'}
      </Button>
      {!canBook && <p className={styles.hint}>Only hikers can book.</p>}
      {canBook && !slot && <p className={styles.hint}>Choose a time to continue.</p>}
    </aside>
  );
}

export function BookingBar({ date, slot, partySize, now, isPending, canBook = true, onReview, availability, isAvailable = true, searchRange }) {
  const summary = [date && formatDay(date), slot ? formatTime(slot.startsAt) : searchRange || '—', partySize]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className={styles.bar}>
      <div className={styles.barSummary}>
        <span className={styles.barChoices}>{summary}</span>
        <span className={styles.barUntil}>
          {!canBook
            ? 'only hikers can book'
            : slot && !searchRange
              ? `book until ${formatBookUntil(date, slot.startsAt, now, slot.bookingClosesAt)}`
              : slot ? ''
              : 'choose a time'}
        </span>
      </div>
      <AvailabilityAnswer answer={availability} partySize={partySize} compact />
      <Button block disabled={!canBook || !slot || !isAvailable || isPending} onClick={onReview}>
        {isPending ? 'Checking…' : 'Review booking'}
      </Button>
    </div>
  );
}
