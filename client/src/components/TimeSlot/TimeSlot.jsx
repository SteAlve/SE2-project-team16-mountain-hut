/**
 * A time slot of the chosen day (Figma "Time slot"): start – end and what its seats say.
 * A slot that is not `bookable` stays visible, cannot be picked, and its `label` says why.
 */
import checkIcon from '../../assets/booking/slot-check.svg';
import dot from '../../assets/booking/seat-dot.svg';
import dotDisabled from '../../assets/booking/seat-dot-disabled.svg';
import { formatTimeRange } from '../../lib/bookingDates.js';
import styles from './TimeSlot.module.css';

export function TimeSlot({ slot, selected, onSelect }) {
  const { startsAt, endsAt, bookable, label } = slot;
  const state = selected ? styles.selected : bookable ? '' : styles.disabled;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={!bookable}
      className={`${styles.slot} ${state}`}
      onClick={onSelect}
    >
      <span className={styles.time}>{formatTimeRange(startsAt, endsAt)}</span>
      <span className={styles.info}>
        {bookable ? (
          <img src={dot} alt="" width="8" height="8" />
        ) : (
          <img src={dotDisabled} alt="" width="6" height="6" />
        )}
        {label}
      </span>
      {selected && <img src={checkIcon} alt="" width="24" height="24" className={styles.check} />}
    </button>
  );
}
