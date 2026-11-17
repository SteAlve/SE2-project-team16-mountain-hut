/**
 * The "Cancel this booking?" dialog (story MH-08, mockup docs/mockups/hiker-booking-page, screen 11 and phone screen 3):
 * the same dialog as Log out. Keep booking, Esc or a click outside calls `onKeep`; Cancel booking calls `onConfirm`.
 * `pending`: the request is running, both buttons are disabled and Esc does nothing.
 * `error`: the note of the last failed try, the booking is still there; Cancel booking tries again.
 */
import { useEffect, useId, useRef } from 'react';
import { cancelSummary } from '../../lib/cancelBooking.js';
import { Alert } from '../Alert/Alert.jsx';
import styles from './CancelBookingDialog.module.css';

export function CancelBookingDialog({ booking, pending = false, error = null, onKeep, onConfirm }) {
  const ref = useRef(null);
  const id = useId();

  // A modal <dialog> keeps the focus inside and puts the rest of the page behind ::backdrop.
  useEffect(() => {
    ref.current.showModal();
  }, []);

  const keep = () => !pending && onKeep();

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-text`}
      onCancel={(event) => {
        // Esc: the browser would close the dialog by itself; the parent decides instead.
        event.preventDefault();
        keep();
      }}
      // A click on the dialog element itself, not on its content, is a click on the backdrop.
      onClick={(event) => event.target === ref.current && keep()}
      // preventDefault stops the first Esc, not a second one: the browser then closes the dialog by itself. While the
      // request runs the dialog is shown again; otherwise the page is told, so it does not keep a booking "being
      // cancelled" that nobody can see (its Cancel booking button would do nothing).
      onClose={() => (pending ? ref.current.showModal() : onKeep())}
    >
      <div className={styles.body}>
        <div>
          <h2 id={`${id}-title`} className={styles.title}>
            Cancel this booking?
          </h2>
          <p id={`${id}-text`} className={styles.text}>
            {cancelSummary(booking)}
          </p>
        </div>
        {error && !pending && <Alert>{error}</Alert>}
        <div className={styles.actions}>
          <button type="button" className={styles.keep} onClick={keep} disabled={pending}>
            Keep booking
          </button>
          <button type="button" className={styles.confirm} onClick={onConfirm} disabled={pending}>
            {pending ? 'Cancelling…' : 'Cancel booking'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
