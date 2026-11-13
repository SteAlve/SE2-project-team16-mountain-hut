/**
 * LOGIN: one login for hikers, employees and the warden (docs/mockups/login, screens 1-4).
 * After login a hiker goes to Book a table, the staff to Slots & tables. A protected page (or
 * Book a table, at Review booking) that sends a visitor here passes `state: { from: '/its/path', page: 'book a table' }`: the page
 * shows "Log in to book a table." and the login goes back to `from`.
 * A hiker whose account was made by the staff (mustChangePassword) goes first to Choose your
 * password (screen 15), and from there on to `from`.
 * "Forgot password?" opens the password reset (screen 10), with the email typed here. After a reset
 * the page gets `state: { passwordChanged: true, email? }` (screen 14).
 */
import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/Alert/Alert.jsx';
import { AuthLayout } from '../../components/AuthLayout/AuthLayout.jsx';
import { TextField } from '../../components/TextField/TextField.jsx';
import { useLoginForm } from '../../hooks/useLoginForm.js';
import { START_PAGE } from '../../lib/roles.js';
import styles from '../authForm.module.css';

export function LoginPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { submit, submitting, fieldErrors, alert, clearFieldError } = useLoginForm();
  const [email, setEmail] = useState(state?.email ?? '');
  const [password, setPassword] = useState('');
  const formRef = useRef(null);

  const focusField = (name) => formRef.current.elements.namedItem(name)?.focus();

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = await submit({ email, password });
    if (result.user?.mustChangePassword) {
      navigate('/change-password', { replace: true, state: state?.from ? { from: state.from } : undefined });
    } else if (result.user) {
      navigate(state?.from ?? START_PAGE[result.user.role]?.path ?? '/', { replace: true });
    } else if (result.errors) {
      focusField(Object.keys(result.errors)[0]);
    } else if (result.status === 401) {
      // Keep the email, empty the password and reopen the keyboard on it.
      setPassword('');
      focusField('password');
    }
  };

  return (
    <AuthLayout
      topLink={
        <>
          No account? <Link to="/signup" state={state}>Sign up</Link>
        </>
      }
    >
      <h1 className={styles.title}>Log in</h1>

      <form ref={formRef} className={styles.fields} onSubmit={handleSubmit} noValidate>
        {alert && <Alert>{alert}</Alert>}
        {!alert && state?.passwordChanged && (
          <Alert variant="info">Your password has been changed. Log in with the new one.</Alert>
        )}
        {!alert && !state?.passwordChanged && state?.page && <Alert variant="info">Log in to {state.page}.</Alert>}
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={email}
          error={fieldErrors.email}
          onChange={(event) => {
            setEmail(event.target.value);
            clearFieldError('email');
          }}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          revealable
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          error={fieldErrors.password}
          onChange={(event) => {
            setPassword(event.target.value);
            clearFieldError('password');
          }}
        />
        <Link to="/forgot-password" state={{ email: email.trim() }} className={styles.forgot}>
          Forgot password?
        </Link>
        <button type="submit" className={styles.submit} disabled={submitting}>
          {submitting && <span className={styles.spinner} aria-hidden="true" />}
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className={styles.after}>
        New here? <Link to="/signup" state={state}>Create a hiker account</Link>
      </p>
    </AuthLayout>
  );
}
