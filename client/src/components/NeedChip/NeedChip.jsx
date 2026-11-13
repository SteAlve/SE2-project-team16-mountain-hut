/**
 * A chosen diet (green) or allergy (red), read-only (Figma "Need chip"): in the folded lines of
 * "Check your booking" and in "Table booked". `kind` is 'diet' or 'allergy'.
 */
import styles from './NeedChip.module.css';

export function NeedChip({ kind, name }) {
  return <span className={`${styles.chip} ${styles[kind]}`}>{name}</span>;
}
