/**
 * The day and the time of the departure or the return of a hike (Figma "Date and time field", MH-20): two boxes side by
 * side, the day with a calendar and the time with a clock. Empty they show "Choose a day" and "–:–"; with `error` both
 * are red and the message sits under them.
 * Each box is a native date or time input made invisible over its text, so the browser's own picker opens (and the
 * keyboard and the screen readers work as in any form). `day` is 'YYYY-MM-DD' and `time` 'HH:MM', or '' while empty.
 */
import { useId } from 'react';
import calendarIcon from '../../assets/hike/calendar.svg';
import clockIcon from '../../assets/hike/clock.svg';
import { formatPickedDay } from '../../lib/hikes.js';
import styles from './DateTimeField.module.css';

// A click anywhere on the box opens the picker (the browser opens it only from its own small icon).
const openPicker = (event) => {
  try {
    event.currentTarget.showPicker?.();
  } catch {
    // Not allowed now (for example, the picker is already open): the input still works typed.
  }
};

export function DateTimeField({ label, day, time, onDayChange, onTimeChange, error, required = false, disabled = false }) {
  const id = useId();
  const noteId = `${id}-error`;
  const invalid = error ? styles.invalid : '';

  return (
    <div className={styles.field}>
      <span id={`${id}-label`} className={styles.label}>
        {label}
        {required && <span className={styles.required} aria-hidden="true"> *</span>}
      </span>
      <div className={styles.row} role="group" aria-labelledby={`${id}-label`}>
        <label className={`${styles.box} ${styles.day} ${invalid}`}>
          <img src={calendarIcon} width="22" height="22" alt="" />
          <span className={day ? styles.value : styles.placeholder}>{day ? formatPickedDay(day) : 'Choose a day'}</span>
          <input
            type="date"
            className={styles.native}
            aria-label={`${label}, day`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? noteId : undefined}
            value={day}
            disabled={disabled}
            onClick={openPicker}
            onChange={(event) => onDayChange(event.target.value)}
          />
        </label>
        <label className={`${styles.box} ${styles.time} ${invalid}`}>
          <img src={clockIcon} width="22" height="22" alt="" />
          <span className={time ? styles.value : styles.placeholder}>{time || '–:–'}</span>
          <input
            type="time"
            className={styles.native}
            aria-label={`${label}, time`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? noteId : undefined}
            value={time}
            disabled={disabled}
            onClick={openPicker}
            onChange={(event) => onTimeChange(event.target.value)}
          />
        </label>
      </div>
      {error && <p id={noteId} className={styles.error}>{error}</p>}
    </div>
  );
}
