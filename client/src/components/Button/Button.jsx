/**
 * A button of the QUOTA kit: `primary` (the one main action), `outline` or `ghost` (navbar).
 * `size` is 'large' (forms) or 'small' (navbar, secondary actions). Other props go to <button>.
 */
import styles from './Button.module.css';

export function Button({ variant = 'primary', size = 'large', block = false, className = '', ...props }) {
  const classes = [styles.button, styles[variant], styles[size], block && styles.block, className]
    .filter(Boolean)
    .join(' ');
  return <button type="button" className={classes} {...props} />;
}
