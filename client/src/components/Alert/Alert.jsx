/**
 * A message on top of a form: `error` (red) or `info` (blue).
 */
import styles from './Alert.module.css';

export function Alert({ variant = 'error', children }) {
  return (
    <div className={`${styles.alert} ${styles[variant]}`} role={variant === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
