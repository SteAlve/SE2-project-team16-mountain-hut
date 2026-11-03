/**
 * The red-white-red trail blaze (Figma "Trail blaze"). Decorative only.
 */
import styles from './TrailBlaze.module.css';

export function TrailBlaze({ className = '' }) {
  return (
    <span className={`${styles.blaze} ${className}`} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}
