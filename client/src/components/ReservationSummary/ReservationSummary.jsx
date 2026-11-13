/**
 * The summary of the New reservation page (MH-07, mockup screens 1-3, 8 and 10, phone screen 1).
 * It fills in as the employee chooses and says until when the chosen time can be entered: its
 * start. `ReservationSummary` is the card on the right (desktop); `ReservationBar` is the bar fixed
 * at the bottom of a phone. The page shows both: CSS picks one. They share the look of the summary
 * of Book a table.
 * Save reservation is enabled once `hiker` and `slot` are chosen; `alert` is the message of the
 * last failure, shown above it.
 */
import { useLayoutEffect, useRef } from 'react';
import { formatDay, formatTime, formatTimeRange, toDay } from '../../lib/bookingDates.js';
import { hikerName } from '../../lib/hikers.js';
import { dayLabel, enterUntil } from '../../lib/staffSlots.js';
import { Alert } from '../Alert/Alert.jsx';
import { Button } from '../Button/Button.jsx';
import { TrailBlaze } from '../TrailBlaze/TrailBlaze.jsx';
import styles from '../BookingSummary/BookingSummary.module.css';

const hint = (hiker, slot) => {
  if (!hiker && !slot) return 'Choose the hiker and a time to continue.';
  if (!hiker) return 'Choose the hiker to continue.';
  return slot ? null : 'Choose a time to continue.';
};

function SaveButton({ hiker, slot, isPending, onSave }) {
  return (
    <Button block disabled={!hiker || !slot || isPending} onClick={onSave}>
      {isPending ? 'Saving…' : 'Save reservation'}
    </Button>
  );
}

export function ReservationSummary({ hiker, date, slot, partySize, now, alert, isPending, onSave }) {
  const notChosen = <span className={styles.empty}>not chosen</span>;
  const missing = hint(hiker, slot);
  return (
    <aside className={styles.card} aria-label="Reservation">
      <h2 className={styles.title}>Reservation</h2>
      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt>Hiker</dt>
          <dd>{hiker ? hikerName(hiker) : notChosen}</dd>
        </div>
        <div className={styles.row}>
          <dt>Day</dt>
          <dd>{date ? dayLabel(date, now) : notChosen}</dd>
        </div>
        <div className={styles.row}>
          <dt>Time</dt>
          <dd className={slot ? styles.mono : ''}>{slot ? formatTimeRange(slot.startsAt, slot.endsAt) : notChosen}</dd>
        </div>
        <div className={styles.row}>
          <dt>People</dt>
          <dd>{partySize}</dd>
        </div>
        <div className={styles.row}>
          <dt>Tables</dt>
          <dd className={styles.empty}>chosen for you</dd>
        </div>
      </dl>

      {slot && (
        <p className={styles.note}>
          <TrailBlaze className={styles.blaze} />
          <span>
            You can enter this time until <strong>{enterUntil(date, slot.startsAt, now)}</strong>, when it starts.
          </span>
        </p>
      )}
      {alert && <Alert>{alert}</Alert>}

      <SaveButton hiker={hiker} slot={slot} isPending={isPending} onSave={onSave} />
      {missing && !alert && <p className={styles.hint}>{missing}</p>}
    </aside>
  );
}

export function ReservationBar({ hiker, date, slot, partySize, now, alert, isPending, onSave }) {
  const barRef = useRef(null);
  useLayoutEffect(() => {
    const bar = barRef.current;
    const screen = bar.parentElement;
    // The alert, font loading and orientation all change the height of the fixed bar.
    const updateSpace = () => {
      const height = Math.ceil(bar.getBoundingClientRect().height);
      screen.style.setProperty('--booking-bar-space', `${height + 16}px`);
    };
    updateSpace();
    const observer = new ResizeObserver(updateSpace);
    observer.observe(bar, { box: 'border-box' });
    return () => {
      observer.disconnect();
      screen.style.removeProperty('--booking-bar-space');
    };
  }, []);

  const day = date && (date === toDay(now) ? 'Today' : formatDay(date));
  const summary = [hiker ? hikerName(hiker) : 'Hiker not chosen', day, slot && formatTime(slot.startsAt), partySize]
    .filter(Boolean)
    .join(' · ');
  return (
    <div ref={barRef} className={styles.bar}>
      <div className={styles.barSummary}>
        <span className={styles.barChoices}>{summary}</span>
        <span className={styles.barUntil}>{slot ? `until ${enterUntil(date, slot.startsAt, now)}` : 'until the start'}</span>
      </div>
      {alert && <Alert>{alert}</Alert>}
      <SaveButton hiker={hiker} slot={slot} isPending={isPending} onSave={onSave} />
    </div>
  );
}
