/**
 * A popular hike of the "Register a hike" dialog (Figma "Hike option", MH-20): a card to press, with the destination,
 * the route and the passage points. `selected` marks the one chosen. Pressing it only fills the form.
 * `hike` is { destination, route, passagePoints }.
 */
import checkIcon from '../../assets/booking/slot-check.svg';
import styles from './HikeOption.module.css';

export function HikeOption({ hike, selected, onSelect }) {
  return (
    <button type="button" role="radio" aria-checked={selected} className={`${styles.option} ${selected ? styles.selected : ''}`} onClick={onSelect}>
      <span className={styles.destination}>{hike.destination}</span>
      <span className={styles.route}>{hike.route}</span>
      {hike.passagePoints.length > 0 && (
        <span className={styles.passage}>Passage: {hike.passagePoints.join(' · ')}</span>
      )}
      {selected && <img src={checkIcon} alt="" width="24" height="24" className={styles.check} />}
    </button>
  );
}
