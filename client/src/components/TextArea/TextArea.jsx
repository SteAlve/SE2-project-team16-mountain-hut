/**
 * A labelled text area (Figma "Text field", the tall one, of the route of a hike, MH-20). Like TextField: a helper
 * text or, when `error` is set, the message under it. The placeholder stays when the field is empty and wrong.
 * With `maxLength` a counter under the field on the right shows the characters used ("318 / 500"), as in the menu
 * editor of MH-10. Any other prop (value, onChange, maxLength, rows...) goes to the <textarea>.
 */
import { useId } from 'react';
import styles from './TextArea.module.css';

export function TextArea({ label, required, error, helper, maxLength, value, ...props }) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? helper;

  return (
    <div className={`${styles.field} ${error ? styles.invalid : ''}`}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && <span className={styles.required} aria-hidden="true"> *</span>}
      </label>
      <textarea
        id={id}
        className={styles.input}
        rows={3}
        value={value}
        maxLength={maxLength}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        {...props}
      />
      {(note || maxLength) && (
        <div className={styles.footer}>
          {note && <p id={noteId} className={error ? styles.error : styles.helper}>{note}</p>}
          {maxLength && (
            <p className={styles.counter} aria-label={`${value.length} of ${maxLength} characters`}>
              {value.length} / {maxLength}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
