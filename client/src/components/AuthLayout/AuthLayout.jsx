/**
 * The split screen of login and sign-up: the brand panel on the left, the form on the right.
 * On a phone the panel becomes a dark header and the form a white sheet over it;
 * `compact` shrinks that header to the logo and the hut name (sign-up).
 * `topLink` is the "No account? Sign up" / "Already registered? Log in" line.
 */
import { Link } from 'react-router-dom';
import { ContourMap } from './ContourMap.jsx';
import { QuotaLogo } from './QuotaLogo.jsx';
import styles from './AuthLayout.module.css';

export function AuthLayout({ topLink, compact = false, children }) {
  return (
    <div className={styles.screen}>
      <aside className={`${styles.brand} ${compact ? styles.compact : ''}`}>
        <ContourMap />
        <div className={styles.brandTop}>
          <QuotaLogo />
          <span className={styles.phoneTopLink}>{topLink}</span>
        </div>

        <div className={styles.hut}>
          <span className={styles.blaze} aria-hidden="true" />
          <p className={styles.hutName}>
            Rifugio Alpe Lunga<span className={styles.hutNameAltitude}> · 2.450 m</span>
          </p>
          <p className={styles.altitude}>2.450 m</p>
          <p className={styles.tagline}>Your seat at altitude.</p>
          <p className={styles.pitch}>
            Book a table at the hut before you start walking: choose the day, how many you are
            and a time.
          </p>
        </div>
      </aside>

      <main className={styles.main}>
        <nav className={styles.topBar}>
          <Link to="/" className={styles.back}>
            ← Back to the hut page
          </Link>
          <span>{topLink}</span>
        </nav>

        <div className={styles.form}>{children}</div>

        <footer className={styles.footer}>
          <Link to="/" className={`${styles.back} ${styles.phoneBack}`}>
            ← Back to the hut page
          </Link>
          <p className={styles.coords}>
            <span className={styles.footerHut}>Rifugio Alpe Lunga · </span>
            <span>45.92° N 7.71° E</span>
            <span className={styles.footerSep}> · </span>
            <span>open June – September</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
