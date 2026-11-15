/**
 * RESET PASSWORD (MH-07, docs/mockups/login screens 12-14, phone 14): the page of the link in the
 * email, /reset-password?token=... The user chooses a new password; the server does not log in, so
 * Save password goes to the login with "Your password has been changed." and the email already
 * written when this browser asked for the link.
 * A link that expired, was used or was replaced is found out at Save password (422
 * RESET_LINK_NOT_VALID, screen 13): "Send a new link" opens Forgot password.
 */
import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert } from '../../components/Alert/Alert.jsx';
import { AuthLayout } from '../../components/AuthLayout/AuthLayout.jsx';
import { TextField } from '../../components/TextField/TextField.jsx';
import { useResetPassword } from '../../hooks/usePasswordReset.js';
import styles from '../authForm.module.css';

const signUpLink = (
  <>
    No account? <Link to="/signup">Sign up</Link>
  </>
);

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const reset = useResetPassword(params.get('token') ?? '');
  const [form, setForm] = useState({ newPassword: '', repeatPassword: '' });
  const formRef = useRef(null);

  const bind = (name) => ({
    name,
    value: form[name],
    error: reset.fieldErrors[name],
    onChange: (event) => {
      setForm((current) => ({ ...current, [name]: event.target.value }));
      reset.clearFieldError(name);
    },
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = await reset.save(form);
    if (result.ok) {
      navigate('/login', { replace: true, state: { passwordChanged: true, email: result.email ?? undefined } });
    } else if (result.errors) {
      formRef.current?.elements.namedItem(Object.keys(result.errors)[0])?.focus();
    }
  };

  if (reset.linkNotValid) {
    return (
      <AuthLayout topLink={signUpLink}>
        <div className={styles.column}>
          <h1 className={styles.title}>This link no longer works</h1>
          <Alert>The link has expired or was already used. Ask for a new one.</Alert>
          <button
            type="button"
            className={styles.submit}
            onClick={() => navigate('/forgot-password', { state: { email: reset.email ?? '' } })}
          >
            Send a new link
          </button>
          <Link to="/login" className={styles.backToLogin}>← Back to log in</Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout topLink={signUpLink}>
      <h1 className={styles.title}>Choose a new password</h1>
      {reset.email && <p className={styles.subtitle}>For {reset.email}.</p>}

      <form ref={formRef} className={styles.fields} onSubmit={handleSubmit} noValidate>
        {reset.alert && <Alert>{reset.alert}</Alert>}
        {/* For the password managers: the account whose password this is. */}
        {reset.email && <input type="email" name="username" autoComplete="username" value={reset.email} readOnly hidden />}
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
        <button type="submit" className={styles.submit} disabled={reset.isPending}>
          {reset.isPending && <span className={styles.spinner} aria-hidden="true" />}
          {reset.isPending ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </AuthLayout>
  );
}
