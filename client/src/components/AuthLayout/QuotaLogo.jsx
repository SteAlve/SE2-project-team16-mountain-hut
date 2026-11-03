/**
 * The QUOTA logo for dark backgrounds: the Q mark (docs/brand/logo/quota-mark-on-dark.svg) and the name.
 */
import styles from './AuthLayout.module.css';

export function QuotaLogo() {
  return (
    <span className={styles.logo}>
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="21" cy="21" r="15" fill="none" stroke="#F3F6F4" strokeWidth="5.5" />
        <path d="M10 29.5 L17.5 17 L22.2 24 L25.8 19.2 L32 29.5 Z" fill="#F3F6F4" />
        <g transform="rotate(28 35 34)">
          <rect x="24" y="30.5" width="8" height="7" rx="1.4" fill="#E0352B" />
          <rect x="32" y="30.5" width="6" height="7" fill="#FFFFFF" />
          <rect x="38" y="30.5" width="8" height="7" rx="1.4" fill="#E0352B" />
        </g>
      </svg>
      QUOTA
    </span>
  );
}
