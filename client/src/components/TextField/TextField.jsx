/**
 * A labelled input with a helper text or, when `error` is set, an error message below it.
 * Any other prop (name, type, value, onChange, autoComplete...) goes to the <input>.
 */
import { useId } from 'react';
import styles from './TextField.module.css';

export function TextField({ label, required, helper, error, placeholder, ...inputProps }) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? helper;

  return (
    <div className={`${styles.field} ${error ? styles.invalid : ''}`}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      <div className={styles.control}>
        <input
          id={id}
          className={styles.input}
          required={required}
          placeholder={error ? undefined : placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          {...inputProps}
        />
        {error && (
          <svg className={styles.icon} width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <rect x="9.1" y="5.2" width="1.8" height="6" rx="0.9" fill="currentColor" />
            <circle cx="10" cy="14.2" r="1.1" fill="currentColor" />
          </svg>
        )}
      </div>
      {note && (
        <p id={noteId} className={error ? styles.error : styles.helper}>
          {note}
        </p>
      )}
    </div>
  );
}
