/**
 * The people stepper (Figma "People stepper"): − value +, from `min` to `max`.
 */
import styles from './PeopleStepper.module.css';

export function PeopleStepper({ value, min = 1, max, onChange, labelledBy }) {
  return (
    <div className={styles.stepper} role="group" aria-labelledby={labelledBy}>
      <button
        type="button"
        className={styles.step}
        aria-label="One fewer"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <output className={styles.value} aria-live="polite">{value}</output>
      <button
        type="button"
        className={styles.step}
        aria-label="One more"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
