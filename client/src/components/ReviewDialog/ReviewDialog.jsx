/**
 * "Check your booking": the last check before the booking is saved (mockup screens 4 and P3).
 * A dialog on desktop, a sheet from the bottom on a phone. Back (or Esc) keeps every choice.
 * `tables` is [{ tableNumber, seats }], the seating preview: a split party gets a sentence that says why.
 * `notice` (optional) is shown on top, e.g. when the tables changed just before confirming.
 */
import { useEffect, useRef } from 'react';
import { formatLongDay, formatTimeRange } from '../../lib/bookingDates.js';
import { Alert } from '../Alert/Alert.jsx';
import { Button } from '../Button/Button.jsx';
import { PartySeats } from '../PartySeats/PartySeats.jsx';
import styles from './ReviewDialog.module.css';

export function ReviewDialog({ open, date, slot, partySize, tables, notice, isPending, onBack, onConfirm }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="review-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!isPending) onBack();
      }}
    >
      {open && slot && (
        <div className={styles.body}>
          <span className={styles.handle} aria-hidden="true" />
          <h2 id="review-title" className={styles.title}>Check your booking</h2>
          {notice && <Alert variant="info">{notice}</Alert>}
          <dl className={styles.rows}>
            <div className={styles.row}>
              <dt>Day</dt>
              <dd>{formatLongDay(date)}</dd>
            </div>
            <div className={styles.row}>
              <dt>Time</dt>
              <dd>{formatTimeRange(slot.startsAt, slot.endsAt)}</dd>
            </div>
            <div className={styles.row}>
              <dt>People</dt>
              <dd>{partySize}</dd>
            </div>
          </dl>

          <PartySeats partySize={partySize} tables={tables} />
          {tables?.length > 1 && (
            <p className={styles.note}>
              No single table has {partySize} free seats at this time, so your party is split
              over {tables.length} tables.
            </p>
          )}

          <div className={styles.actions}>
            <Button variant="outline" size="small" className={styles.back} disabled={isPending} onClick={onBack}>
              Back
            </Button>
            <Button className={styles.confirm} disabled={isPending} onClick={onConfirm} autoFocus>
              {isPending ? 'Booking…' : 'Confirm booking'}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
