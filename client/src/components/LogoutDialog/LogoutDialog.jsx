/**
 * The "Log out?" dialog (docs/mockups/login, screens 8-9 and phone screens 11-12).
 * Cancel, Esc or a click outside calls `onCancel`; Log out calls `onConfirm`.
 * `pending`: the request is running, both buttons are disabled and Esc does nothing.
 * `failed`: the last try failed, the user is still logged in; Log out tries again.
 */
import { useEffect, useId, useRef } from 'react';
import { Alert } from '../Alert/Alert.jsx';
import styles from './LogoutDialog.module.css';

export function LogoutDialog({ pending = false, failed = false, onCancel, onConfirm }) {
  const ref = useRef(null);
  const id = useId();

  // A modal <dialog> keeps the focus inside and puts the rest of the page behind ::backdrop.
  useEffect(() => {
    ref.current.showModal();
  }, []);

  const cancel = () => !pending && onCancel();

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-text`}
      onCancel={(event) => {
        // Esc: the browser would close the dialog by itself; the parent decides instead.
        event.preventDefault();
        cancel();
      }}
      // A click on the dialog element itself, not on its content, is a click on the backdrop.
      onClick={(event) => event.target === ref.current && cancel()}
    >
      <div className={styles.body}>
        <div>
          <h2 id={`${id}-title`} className={styles.title}>
            Log out?
          </h2>
          <p id={`${id}-text`} className={styles.text}>
            You will need your email and password to log in again.
          </p>
        </div>
        {failed && !pending && (
          <Alert>You are still logged in: something went wrong on our side. Try again in a minute.</Alert>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={cancel} disabled={pending}>
            Cancel
          </button>
          <button type="button" className={styles.confirm} onClick={onConfirm} disabled={pending}>
            {pending ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
