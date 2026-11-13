/**
 * FORGOT PASSWORD (MH-07, docs/mockups/login screens 10-11, phone 13): the email of the account,
 * then "Check your email" in place of the form. The answer is the same whether the email has an
 * account or not, so nobody can find out which emails are registered. "Send it again" asks for a new
 * link, and the previous one stops working.
 * The login (with the email typed there) and "Send a new link" of an old link pass
 * `state: { email }` to write it already.
 */
import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Alert } from '../../components/Alert/Alert.jsx';
import { AuthLayout } from '../../components/AuthLayout/AuthLayout.jsx';
import { TextField } from '../../components/TextField/TextField.jsx';
import { useForgotPassword } from '../../hooks/usePasswordReset.js';
import styles from '../authForm.module.css';

const signUpLink = (
  <>
    No account? <Link to="/signup">Sign up</Link>
  </>
);

export function ForgotPasswordPage() {
  const { state } = useLocation();
  const { send, sentTo, isPending, fieldErrors, alert, clearFieldError } = useForgotPassword();
  const [email, setEmail] = useState(state?.email ?? '');
  const formRef = useRef(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = await send(email);
    if (result.errors) formRef.current.elements.namedItem('email')?.focus();
  };

  const backToLogin = <Link to="/login" className={styles.backToLogin}>← Back to log in</Link>;

  if (sentTo) {
    return (
      <AuthLayout topLink={signUpLink}>
        <div className={styles.column}>
          <h1 className={styles.title}>Check your email</h1>
          <p className={styles.subtitle}>
            If there is an account for {sentTo}, we have sent it a link to choose a new password. Look
            also in the spam folder.
          </p>
          {alert && <Alert>{alert}</Alert>}
          <button type="button" className={styles.secondary} disabled={isPending} onClick={() => send(sentTo)}>
            {isPending ? 'Sending…' : 'Send it again'}
          </button>
          {backToLogin}
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout topLink={signUpLink}>
      <h1 className={styles.title}>Forgot your password?</h1>
      <p className={styles.subtitle}>Enter the email of your account. We send you a link to choose a new password.</p>

      <form ref={formRef} className={styles.fields} onSubmit={handleSubmit} noValidate>
        {alert && <Alert>{alert}</Alert>}
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
        <button type="submit" className={styles.submit} disabled={isPending}>
          {isPending && <span className={styles.spinner} aria-hidden="true" />}
          {isPending ? 'Sending…' : 'Send the link'}
        </button>
      </form>
      {backToLogin}
    </AuthLayout>
  );
}
