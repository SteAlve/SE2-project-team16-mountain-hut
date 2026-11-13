/**
 * CHANGE THE PASSWORD AT THE FIRST LOGIN (MH-07, docs/mockups/login screens 15-17, phone 15): a hiker
 * whose account was made by the hut staff logged in with the password we emailed, and must choose
 * their own before anything else. The login and every app page (AppLayout) send them here, with
 * `state: { from }` when they were on their way to a page.
 * Once saved, the user goes on as after any login: back to `from`, or the start page of the role.
 * "Not now? Log out" leaves without changing it, and the next login asks again.
 * Nobody logged in goes to the login; a user who does not have to change the password goes on.
 */
import { useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Alert } from '../../components/Alert/Alert.jsx';
import { AuthLayout } from '../../components/AuthLayout/AuthLayout.jsx';
import { TextField } from '../../components/TextField/TextField.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useChangePassword } from '../../hooks/useChangePassword.js';
import { useLogout } from '../../hooks/useLogout.js';
import { SAME_PASSWORD } from '../../lib/validateAuthForms.js';
import { START_PAGE } from '../../lib/roles.js';
import styles from '../authForm.module.css';

const EMPTY_FORM = { currentPassword: '', newPassword: '', repeatPassword: '' };
const LOGOUT_FAILED = 'You are still logged in: something went wrong on our side. Try again in a minute.';

export function ChangePasswordPage() {
  const { state } = useLocation();
  const { user, isLoading } = useAuth();
  const { save, submitting, fieldErrors, alert, clearFieldError } = useChangePassword();
  const { logout, isPending: loggingOut } = useLogout();
  const [form, setForm] = useState(EMPTY_FORM);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const formRef = useRef(null);

  if (isLoading) return null;
  if (!user || sessionEnded) return <Navigate to="/login" replace />;
  // Saved just now (useAuth already has the user without the obligation), or nothing to change.
  if (!user.mustChangePassword) {
    return <Navigate to={state?.from ?? START_PAGE[user.role]?.path ?? '/'} replace />;
  }

  const focusField = (name) => formRef.current?.elements.namedItem(name)?.focus();

  const bind = (name) => ({
    name,
    value: form[name],
    error: fieldErrors[name],
    onChange: (event) => {
      setForm((current) => ({ ...current, [name]: event.target.value }));
      clearFieldError(name);
    },
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLogoutFailed(false);
    const result = await save(form);
    if (result.errors?.newPassword === SAME_PASSWORD) {
      // The two new fields are emptied; the current one is kept.
      setForm((current) => ({ ...current, newPassword: '', repeatPassword: '' }));
      focusField('newPassword');
    } else if (result.errors?.currentPassword && !result.errors.newPassword && !result.errors.repeatPassword) {
      // Wrong (or empty) current password: emptied, with the focus; the new ones are kept.
      setForm((current) => ({ ...current, currentPassword: '' }));
      focusField('currentPassword');
    } else if (result.errors) {
      focusField(Object.keys(result.errors)[0]);
    } else if (result.status === 401) {
      setSessionEnded(true);
    }
  };

  const handleLogout = async () => {
    setLogoutFailed(!(await logout()));
  };

  const busy = submitting || loggingOut;

  return (
    <AuthLayout compact noExits>
      <h1 className={styles.title}>Choose your password</h1>
      <p className={styles.subtitle}>
        Hello {user.firstName}. Your account was made by the hut staff: choose your own password to continue.
      </p>

      <form ref={formRef} className={styles.fields} onSubmit={handleSubmit} noValidate>
        {(alert || logoutFailed) && <Alert>{alert ?? LOGOUT_FAILED}</Alert>}
        {/* For the password managers: the account whose password this is. */}
        <input type="email" name="username" autoComplete="username" value={user.email} readOnly hidden />
        <TextField
          label="Current password"
          required
          type="password"
          revealable
          autoComplete="current-password"
          placeholder="The password we emailed you"
          {...bind('currentPassword')}
        />
        <TextField
          label="New password"
          required
          type="password"
          revealable
          autoComplete="new-password"
          placeholder="At least 8 characters"
          {...bind('newPassword')}
        />
        <TextField
          label="Repeat password"
          required
          type="password"
          revealable
          autoComplete="new-password"
          placeholder="Same as above"
          {...bind('repeatPassword')}
        />
        <button type="submit" className={styles.submit} disabled={busy}>
          {submitting && <span className={styles.spinner} aria-hidden="true" />}
          {submitting ? 'Saving…' : 'Save and continue'}
        </button>
      </form>

      <p className={styles.after}>
        Not now?{' '}
        <button type="button" className={styles.linkButton} disabled={busy} onClick={handleLogout}>
          {loggingOut ? 'Logging out…' : 'Log out'}
        </button>
      </p>
    </AuthLayout>
  );
}
