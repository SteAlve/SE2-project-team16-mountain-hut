/**
 * One booking of "My bookings" (Figma "Booking card", mockup docs/mockups/hiker-booking-page, screens 1-2):
 * the day, the time, the reference, the people, the tables, the dietary needs, Edit and Cancel booking.
 * Edit is faded and cannot be pressed once the 48 hours have passed (`booking.canChange` false), and
 * the line under it says when the changes closed. Cancel booking (story MH-08, screen 11) is always open: it calls
 * `onCancel`, and the page asks to confirm.
 * `booking` is an item of GET /api/bookings. On a phone only the first 2 needs are listed, on a
 * computer the first 5; a black +N chip says how many are not.
 */
import { bookingChips, bookingRequests } from '../../lib/dietaryNeeds.js';
import { dayParts, formatTimeRange } from '../../lib/bookingDates.js';
import { bookingReference, changeLine } from '../../lib/changeBooking.js';
import { Button } from '../Button/Button.jsx';
import { NeedChip } from '../NeedChip/NeedChip.jsx';
import { TableChips } from '../TableChips/TableChips.jsx';
import styles from './BookingCard.module.css';

const MAX_CHIPS = { desktop: 5, phone: 2 };

export function BookingCard({ booking, isPhone, onEdit, onCancel }) {
  const { weekday, day, month } = dayParts(booking.date);
  const reference = bookingReference(booking.id);
  const chips = bookingChips(booking.requirements);
  const max = isPhone ? MAX_CHIPS.phone : MAX_CHIPS.desktop;
  const requests = bookingRequests(booking.requirements);
  const hidden = chips.length - max;
  const line = changeLine(booking);

  return (
    <li className={styles.card} aria-label={`Booking ${reference}`}>
      <div className={styles.day} aria-hidden="true">
        <span className={styles.weekday}>{weekday}</span>
        <span className={styles.number}>{day}</span>
        <span className={styles.month}>{month}</span>
      </div>

      <div className={styles.details}>
        <div className={styles.when}>
          <h3 className={styles.time}>
            <span className={styles.hidden}>{`${weekday} ${day} ${month}, `}</span>
            {formatTimeRange(booking.startsAt, booking.endsAt)}
          </h3>
          <span className={styles.reference}>{reference}</span>
        </div>

        <div className={styles.party}>
          <span className={styles.people}>{booking.partySize} {booking.partySize === 1 ? 'person' : 'people'}</span>
          <TableChips tables={booking.tables.map(({ tableNumber, seats }) => ({ tableNumber, capacity: seats }))} />
        </div>

        {chips.length === 0 && requests.length === 0 && <p className={styles.noNeeds}>No dietary needs</p>}
        {chips.length > 0 && (
          <ul className={styles.needs} aria-label="Dietary needs">
            {chips.slice(0, max).map((chip) => (
              <li key={`${chip.kind}:${chip.name}`}><NeedChip kind={chip.kind} name={chip.name} /></li>
            ))}
            {hidden > 0 && (
              <li>
                <span className={styles.more} aria-label={`${hidden} more`}>+{hidden}</span>
              </li>
            )}
          </ul>
        )}
        {requests.length > 0 && (
          <p className={styles.requests} title={requests.join(' · ')}>Other requests: {requests.join(' · ')}</p>
        )}

        {line && (
          <p className={styles.line}>
            <span className={styles.dot} aria-hidden="true" />
            {line.text}
          </p>
        )}
      </div>

      <div className={styles.actions}>
        <Button variant="outline" size="small" disabled={!booking.canChange} onClick={() => onEdit(booking)}>
          Edit
        </Button>
        <Button variant="danger" size="small" onClick={() => onCancel(booking)}>
          Cancel booking
        </Button>
      </div>
    </li>
  );
}
