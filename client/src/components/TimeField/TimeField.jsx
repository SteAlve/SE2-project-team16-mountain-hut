/**
 * COMPONENT: keyboard-accessible time picker for the public slot search.
 * From and To describe a search range, not a new meal slot. Minutes use five-minute steps.
 */
import { useId, useRef, useState } from 'react';
import { Button } from '../Button/Button.jsx';
import styles from './TimeField.module.css';

const pad = (value) => String(value).padStart(2, '0');
export function TimeField({ label, value, onChange, after }) {
  const descriptionId = useId();
  const dialog = useRef(null);
  const trigger = useRef(null);
  const [hour, setHour] = useState('12');
  const [minute, setMinute] = useState('00');
  const open = () => {
    const [h, m] = (value || '12:00').split(':');
    setHour(h);
    setMinute(m);
    dialog.current.showModal();
    const bounds = trigger.current.getBoundingClientRect();
    dialog.current.style.setProperty('--picker-left', `${Math.max(16, Math.min(bounds.right - 300, window.innerWidth - 316))}px`);
    dialog.current.style.setProperty('--picker-top', `${Math.max(16, Math.min(bounds.bottom + 8, window.innerHeight - dialog.current.offsetHeight - 16))}px`);
    // A select opened inside a previously hidden dialog may still be scrolled to 00.
    // Wait for the restored value to render, then reveal the actual selected hour/minute.
    const picker = dialog.current;
    requestAnimationFrame(() => {
      if (!picker.isConnected || !picker.open) return;
      picker.querySelectorAll('select').forEach((select) => {
        select.selectedOptions[0]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    });
  };
  return (
    <div className={styles.field}>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-describedby={descriptionId}
        aria-haspopup="dialog"
        onClick={open}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v5.5l3.5 2" />
        </svg>
        <span className={styles.text}>
          <span>{label}</span>
          <strong>{value || 'Choose'}</strong>
        </span>
        <span className={styles.caret} aria-hidden="true">▾</span>
      </button>
      <span id={descriptionId} className={styles.description}>
        {value ? `Selected time ${value}` : 'Choose a time'}
      </span>
      <dialog ref={dialog} className={styles.dialog} aria-label={`Choose ${label.toLowerCase()} time`} onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close();
      }}>
        <h2>{label}</h2>
        <div className={styles.wheels}>
          <label>
            Hour
            <select aria-label={`${label} hour`} size={5} value={hour} onChange={(event) => setHour(event.target.value)}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={pad(h)}>{pad(h)}</option>
              ))}
            </select>
          </label>
          <label>
            Minute
            <select aria-label={`${label} minute`} size={5} value={minute} onChange={(event) => setMinute(event.target.value)}>
              {Array.from({ length: 12 }, (_, m) => (
                <option key={m} value={pad(m * 5)}>{pad(m * 5)}</option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.actions}>
          <Button variant="outline" onClick={() => dialog.current.close()}>Cancel</Button>
          <Button
            disabled={Boolean(after && `${hour}:${minute}` <= after)}
            onClick={() => {
              onChange(`${hour}:${minute}`);
              dialog.current.close();
            }}
          >
            Done
          </Button>
        </div>
        {after && `${hour}:${minute}` <= after && <p>Choose a time later than {after}.</p>}
      </dialog>
    </div>
  );
}
