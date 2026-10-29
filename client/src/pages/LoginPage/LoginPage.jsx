/**
 * LOGIN: one login for hikers, employees and the manager (docs/mockups/login, screens 1-4).
 * After login a hiker goes to Book a table, the staff to Slots & tables. A protected page that
 * sends a visitor here passes `state: { from: '/its/path', page: 'book a table' }`: the page
 * shows "Log in to book a table." and the login goes back to `from`.
 */
import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/Alert/Alert.jsx';
import { AuthLayout } from '../../components/AuthLayout/AuthLayout.jsx';
import { TextField } from '../../components/TextField/TextField.jsx';
import { useLoginForm } from '../../hooks/useLoginForm.js';
import styles from '../authForm.module.css';

const START_PAGE = { HIKER: '/book', EMPLOYEE: '/slots', WARDEN: '/slots' };

export function LoginPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { submit, submitting, fieldErrors, alert, clearFieldError } = useLoginForm();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const formRef = useRef(null);

  const focusField = (name) => formRef.current.elements.namedItem(name)?.focus();

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = await submit({ email, password });
    if (result.user) {
      navigate(state?.from ?? START_PAGE[result.user.role] ?? '/', { replace: true });
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
          No account? <Link to="/signup">Sign up</Link>
        </>
      }
    >
      <h1 className={styles.title}>Log in</h1>

      <form ref={formRef} className={styles.fields} onSubmit={handleSubmit} noValidate>
        {alert && <Alert>{alert}</Alert>}
        {!alert && state?.page && <Alert variant="info">Log in to {state.page}.</Alert>}
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
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          error={fieldErrors.password}
          onChange={(event) => {
            setPassword(event.target.value);
            clearFieldError('password');
          }}
        />
        <button type="submit" className={styles.submit} disabled={submitting}>
          {submitting && <span className={styles.spinner} aria-hidden="true" />}
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className={styles.after}>
        New here? <Link to="/signup">Create a hiker account</Link>
      </p>
    </AuthLayout>
  );
}
