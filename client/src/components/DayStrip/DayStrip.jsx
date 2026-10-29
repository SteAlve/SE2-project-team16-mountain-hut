/**
 * The day strip of the booking page (Figma "Day"). `days` is [{ date, hasSlots }]: a day without
 * slots is shown as "no slots" and cannot be picked. `today` gets the red dot.
 * On a phone the strip scrolls sideways.
 */
import todayDot from '../../assets/booking/today-dot.svg';
import { dayParts } from '../../lib/bookingDates.js';
import styles from './DayStrip.module.css';

export function DayStrip({ days, selected, today, onSelect, labelledBy }) {
  return (
    <div className={styles.strip} role="radiogroup" aria-labelledby={labelledBy}>
      {days.map(({ date, hasSlots }) => {
        const { weekday, day, month } = dayParts(date);
        const isSelected = date === selected;
        const isEmpty = hasSlots === false;
        const state = isSelected ? styles.selected : isEmpty ? styles.empty : '';
        return (
          <button
            key={date}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={!hasSlots}
            className={`${styles.day} ${state}`}
            onClick={() => onSelect(date)}
          >
            <span className={styles.weekday}>{weekday}</span>
            <span className={styles.number}>{day}</span>
            <span className={styles.month}>{isEmpty ? 'no slots' : month}</span>
            {date === today && (
              <img src={todayDot} alt="today" width="6" height="6" className={styles.today} />
            )}
          </button>
        );
      })}
    </div>
  );
}
