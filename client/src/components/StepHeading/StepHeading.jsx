/**
 * The heading of a step of a form: a number in a circle and a title. `done` fills the circle.
 * `aside` is shown at the right end (e.g. the current time). `id` lets a group point at it.
 */
import styles from './StepHeading.module.css';

export function StepHeading({ number, title, done = false, aside, id }) {
  return (
    <div className={styles.heading}>
      <h2 className={styles.title} id={id}>
        <span className={`${styles.number} ${done ? styles.done : ''}`} aria-hidden="true">{number}</span>
        {title}
      </h2>
      {aside}
    </div>
  );
}
