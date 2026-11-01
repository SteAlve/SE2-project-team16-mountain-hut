/**
 * STAFF ONLY: what a hiker sees on a staff page opened by URL (docs/mockups/login, screen 7 and
 * phone screen 10). It is shown at the URL they opened, with a way to their own start page.
 */
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { ROLE_LABEL, START_PAGE } from '../../lib/roles.js';
import styles from './StaffOnlyPage.module.css';

export function StaffOnlyPage() {
  const { user } = useAuth();
  const start = START_PAGE[user?.role];

  return (
    <main className={styles.page}>
      <span className={styles.blaze} aria-hidden="true" />
      <h1 className={styles.title}>Staff only</h1>
      <p className={styles.text}>
        This page is for the hut team.{' '}
        <span className={styles.line}>
          You are logged in as a {ROLE_LABEL[user?.role]?.toLowerCase() ?? 'user'}.
        </span>
      </p>
      {start && (
        <Link to={start.path} className={styles.button}>
          Go to {start.label}
        </Link>
      )}
    </main>
  );
}
