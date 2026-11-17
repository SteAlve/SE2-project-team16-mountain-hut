/**
 * A hiker of the New reservation page (Figma "Hiker option", MH-07): a radio, the initials, the name,
 * the email and the phone. On desktop they are on one line, on a phone on three.
 * With `onSelect` it is a result of the search, a radio that chooses the hiker. Without it, it is the
 * hiker already chosen (`State=Selected`). A temporary hiker has no email; a missing phone is left out.
 * `hiker` is { firstName, lastName, email, phone }.
 */
import { hikerInitials, hikerName } from '../../lib/hikers.js';
import styles from './HikerOption.module.css';

function Content({ hiker }) {
  return (
    <>
      <span className={styles.radio} aria-hidden="true" />
      <span className={styles.avatar} aria-hidden="true">{hikerInitials(hiker)}</span>
      <span className={styles.name}>{hikerName(hiker)}</span>
      <span className={styles.email}>{hiker.email}</span>
      <span className={styles.phone}>{hiker.phone}</span>
    </>
  );
}

export function HikerOption({ hiker, onSelect }) {
  if (!onSelect) {
    return (
      <div className={`${styles.option} ${styles.selected}`}>
        <Content hiker={hiker} />
      </div>
    );
  }
  return (
    <button type="button" role="radio" aria-checked={false} className={styles.option} onClick={onSelect}>
      <Content hiker={hiker} />
    </button>
  );
}
