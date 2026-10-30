/**
 * The navbar of the app pages (Figma "Navbar / Logged in", "Phone / Top bar").
 * `links` is [{ to, label }]: only the pages of the user's role. With a `user` it shows the
 * avatar, the name, the role and Log out; without one, Log in. Below 992 px the links and the
 * user fold into the menu button.
 */
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import qMark from '../../assets/booking/q-mark.svg';
import menuIcon from '../../assets/booking/menu.svg';
import { Button } from '../Button/Button.jsx';
import styles from './Navbar.module.css';

const ROLE_LABELS = { HIKER: 'Hiker', EMPLOYEE: 'Employee', WARDEN: 'Manager' };

const initialsOf = (user) => `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();

export function Navbar({ links, user, onLogout, loginTo = '/login' }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className={styles.navbar}>
      <Link to="/" className={styles.logo} aria-label="QUOTA, home">
        <img src={qMark} alt="" width="48" height="48" className={styles.mark} />
        <span className={styles.wordmark}>QUOTA</span>
      </Link>

      <button
        type="button"
        className={styles.menuButton}
        aria-expanded={isOpen}
        aria-controls="navbar-menu"
        aria-label="Menu"
        onClick={() => setIsOpen((open) => !open)}
      >
        <img src={menuIcon} alt="" width="22" height="22" />
      </button>

      <div id="navbar-menu" className={`${styles.menu} ${isOpen ? styles.open : ''}`}>
        <nav className={styles.links}>
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {user ? (
          <>
            <div className={styles.user}>
              <span className={styles.avatar} aria-hidden="true">{initialsOf(user)}</span>
              <span className={styles.who}>
                <span className={styles.name}>{user.firstName} {user.lastName}</span>
                <span className={styles.role}>{ROLE_LABELS[user.role] ?? user.role}</span>
              </span>
            </div>
            <Button variant="ghost" size="small" onClick={onLogout}>Log out</Button>
          </>
        ) : (
          <Link to={loginTo} className={styles.login}>Log in</Link>
        )}
      </div>
    </header>
  );
}
