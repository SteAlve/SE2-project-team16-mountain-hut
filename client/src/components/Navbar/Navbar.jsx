/**
 * The navbar of the app pages (docs/mockups/login, screen 7 and phone screens 7-9).
 * Logged in: the logo, only the pages of the user's role, who is logged in, and Log out.
 * `onLogout` is called when Log out is clicked: the parent asks first.
 * Logged out (`user` null): the logo, The hut and Log in.
 * On a phone it is a top bar with a menu button; the menu closes on a link, on Esc or outside it.
 */
import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { NAV_PAGES, PAGES, ROLE_LABEL, ROLES } from '../../lib/roles.js';
import closeIcon from '../../assets/close.svg';
import menuIcon from '../../assets/menu.svg';
import quotaMark from '../../assets/quota-mark.svg';
import styles from './Navbar.module.css';

const initials = ({ firstName, lastName }) => `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();

function Avatar({ user, className }) {
  // The manager's avatar is filled, so the role stands out.
  const strong = user.role === ROLES.WARDEN ? styles.avatarStrong : '';
  return (
    <span className={`${styles.avatar} ${strong} ${className}`} aria-hidden="true">
      {initials(user)}
    </span>
  );
}

function Who({ user }) {
  return (
    <span className={styles.who}>
      <span className={styles.name}>
        {user.firstName} {user.lastName}
      </span>
      <span className={styles.role}>{ROLE_LABEL[user.role]}</span>
    </span>
  );
}

const linkClass =
  (base) =>
  ({ isActive }) =>
    `${base} ${isActive ? styles.active : ''}`;

export function Navbar({ user, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pages = user ? NAV_PAGES[user.role] ?? [PAGES.hut] : [PAGES.hut];
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (event) => event.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <header className={styles.navbar}>
      <Link to="/" className={styles.logo} onClick={closeMenu}>
        <img src={quotaMark} width="34" height="34" alt="" />
        QUOTA
      </Link>

      <nav className={styles.links} aria-label="Pages">
        {pages.map(({ path, label }) => (
          <NavLink key={path} to={path} end className={linkClass(styles.link)}>
            {label}
          </NavLink>
        ))}
      </nav>

      {user ? (
        <>
          <div className={styles.user}>
            <Avatar user={user} />
            <Who user={user} />
          </div>
          <button type="button" className={`${styles.ghost} ${styles.desktopOnly}`} onClick={onLogout}>
            Log out
          </button>

          <button
            type="button"
            className={styles.menuButton}
            aria-expanded={menuOpen}
            aria-controls="navbar-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <img src={menuOpen ? closeIcon : menuIcon} width="22" height="22" alt="" />
          </button>

          {menuOpen && (
            <>
              <div className={styles.scrim} onClick={closeMenu} aria-hidden="true" />
              <div id="navbar-menu" className={styles.menu}>
                <div className={styles.me}>
                  <Avatar user={user} className={styles.avatarLarge} />
                  <Who user={user} />
                </div>
                <nav className={styles.menuLinks} aria-label="Pages">
                  {pages.map(({ path, label }) => (
                    <NavLink
                      key={path}
                      to={path}
                      end
                      className={linkClass(styles.menuLink)}
                      onClick={closeMenu}
                    >
                      {label}
                    </NavLink>
                  ))}
                </nav>
                <button
                  type="button"
                  className={styles.menuLogout}
                  onClick={() => {
                    closeMenu();
                    onLogout();
                  }}
                >
                  Log out
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <Link to="/login" className={styles.ghost}>
          Log in
        </Link>
      )}
    </header>
  );
}
