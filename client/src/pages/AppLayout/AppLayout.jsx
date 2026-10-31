/**
 * APP LAYOUT: the frame of every page but login and sign-up: the navbar on top, the page below.
 * Log out asks first in a dialog, then ends the session and goes back to the public hut page.
 * If it fails the user stays logged in where they are, and the dialog says so.
 */
import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogoutDialog } from '../../components/LogoutDialog/LogoutDialog.jsx';
import { Navbar } from '../../components/Navbar/Navbar.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useLogout } from '../../hooks/useLogout.js';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, isLoading } = useAuth();
  const { logout, isPending } = useLogout();
  // null (closed), 'confirm' or 'failed'
  const [dialog, setDialog] = useState(null);
  // The page left by logging out. The router moves to the hut page a render after the user is
  // gone: drawn in between, a protected page would send the visitor to the login.
  const [leaving, setLeaving] = useState(null);
  if (leaving !== null && pathname !== leaving) setLeaving(null);

  const handleConfirm = async () => {
    if (!(await logout())) {
      setDialog('failed');
      return;
    }
    setDialog(null);
    if (pathname !== '/') setLeaving(pathname);
    navigate('/', { replace: true });
  };

  return (
    <div className={styles.app}>
      {/* Until the server says who is logged in, a logged-out navbar would flash. */}
      {!isLoading && <Navbar user={user} onLogout={() => setDialog('confirm')} />}
      <div className={styles.page}>{leaving === null && <Outlet />}</div>
      {dialog && (
        <LogoutDialog
          pending={isPending}
          failed={dialog === 'failed'}
          onCancel={() => setDialog(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
