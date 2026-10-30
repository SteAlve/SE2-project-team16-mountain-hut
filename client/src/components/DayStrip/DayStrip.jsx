/**
 * The day strip of the booking page (Figma "Day"). `days` is [{ date, hasSlots }]: a day without
 * slots is shown as "no slots" and cannot be picked. `today` gets the red dot.
 * The strip scrolls sideways and has no end: `onReachEnd` is called when its last day comes near,
 * to add the next days. On a computer the arrows scroll it too.
 */
import { useEffect, useRef, useState } from 'react';
import chevron from '../../assets/booking/chevron.svg';
import todayDot from '../../assets/booking/today-dot.svg';
import { dayParts } from '../../lib/bookingDates.js';
import styles from './DayStrip.module.css';

// How early, before the last day is in view, the next days are asked for.
const REACH_END_MARGIN = '0px 300px 0px 0px';

export function DayStrip({ days, selected, today, onSelect, onReachEnd, labelledBy }) {
  const stripRef = useRef(null);
  const endRef = useRef(null);
  const [atStart, setAtStart] = useState(true);

  // A new observer for every length: if the end is still in view after the new days, it fires again.
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && onReachEnd?.(),
      { root: stripRef.current, rootMargin: REACH_END_MARGIN },
    );
    observer.observe(endRef.current);
    return () => observer.disconnect();
  }, [days.length, onReachEnd]);

  // The chosen day stays in view, also when it comes from the URL and is far ahead.
  useEffect(() => {
    const button = stripRef.current?.querySelector('[aria-checked="true"]');
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selected]);

  const scrollBy = (direction) => {
    const strip = stripRef.current;
    strip.scrollBy({ left: direction * strip.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.arrow} ${styles.back}`}
        aria-label="Earlier days"
        disabled={atStart}
        onClick={() => scrollBy(-1)}
      >
        <img src={chevron} alt="" width="20" height="20" />
      </button>

      <div
        ref={stripRef}
        className={styles.strip}
        role="radiogroup"
        aria-labelledby={labelledBy}
        onScroll={(e) => setAtStart(e.currentTarget.scrollLeft <= 0)}
      >
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
        <span ref={endRef} className={styles.end} aria-hidden="true" />
      </div>

      <button
        type="button"
        className={styles.arrow}
        aria-label="Later days"
        onClick={() => scrollBy(1)}
      >
        <img src={chevron} alt="" width="20" height="20" />
      </button>
    </div>
  );
}
