/**
 * The day and the time of the departure or the return of a hike (Figma "Date and time field", MH-20): two boxes side by
 * side, the day with a calendar and the time with a clock. Empty they show "Choose a day" and "–:–"; with `error` both
 * are red and the message sits under them.
 * The day is a native date input made invisible over its text, so the browser's own calendar opens (and the keyboard
 * and the screen readers work as in any form). The time is the time picker of the home page (TimeField, hour and
 * minutes every 5, then Done), drawn as the box: not a time input, since Safari and Firefox have no picker for it.
 * `day` is 'YYYY-MM-DD' and `time` 'HH:MM', or '' while empty.
 */
import { useId } from 'react';
import calendarIcon from '../../assets/hike/calendar.svg';
import { formatPickedDay } from '../../lib/hikes.js';
import { TimeField } from '../TimeField/TimeField.jsx';
import styles from './DateTimeField.module.css';

// Opens the picker of the date input (the browser opens it only from its own small icon). Where it is not allowed or
// not supported, the input still works with the keyboard.
const showPicker = (control) => {
  try {
    control?.showPicker?.();
  } catch {
    // Not allowed now (for example, the picker is already open).
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
            onClick={(event) => showPicker(event.currentTarget)}
            onChange={(event) => onDayChange(event.target.value)}
          />
        </label>
        <div className={styles.time}>
          <TimeField
            variant="box"
            label={label}
            value={time}
            onChange={onTimeChange}
            invalid={Boolean(error)}
            describedBy={error ? noteId : undefined}
            disabled={disabled}
          />
        </div>
      </div>
      {error && <p id={noteId} className={styles.error}>{error}</p>}
    </div>
  );
}
