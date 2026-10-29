/**
 * SIGN UP: only hikers create an account here (docs/mockups/login, screens 5-6).
 * The hiker is logged in straight away and goes to Book a table.
 */
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/Alert/Alert.jsx';
import { AuthLayout } from '../../components/AuthLayout/AuthLayout.jsx';
import { TextField } from '../../components/TextField/TextField.jsx';
import { EMAIL_TAKEN, useSignUpForm } from '../../hooks/useSignUpForm.js';
import styles from '../authForm.module.css';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  repeatPassword: '',
};

export function SignUpPage() {
  const navigate = useNavigate();
  const { submit, submitting, fieldErrors, alert, clearFieldError } = useSignUpForm();
  const [form, setForm] = useState(EMPTY_FORM);
  const formRef = useRef(null);

  const focusField = (name) => formRef.current.elements.namedItem(name)?.focus();

  // Props for the field bound to `name` in the form state.
  const bind = (name) => ({
    name,
    value: form[name],
    error: fieldErrors[name],
    onChange: (event) => {
      setForm((current) => ({ ...current, [name]: event.target.value }));
      clearFieldError(name);
    },
  });

  const emailError =
    fieldErrors.email === EMAIL_TAKEN ? (
      <>
        An account with this email already exists. <Link to="/login">Log in</Link> instead.
      </>
    ) : (
      fieldErrors.email
    );

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = await submit(form);
    if (result.user) {
      navigate('/book', { replace: true });
    } else if (result.errors) {
      // Focusing the first wrong field also scrolls the page to it.
      focusField(Object.keys(result.errors)[0]);
    } else if (result.status === 409) {
      focusField('email');
    }
  };

  return (
    <AuthLayout
      compact
      topLink={
        <>
          Already registered? <Link to="/login">Log in</Link>
        </>
      }
    >
      <h1 className={styles.title}>Create your account</h1>
      <p className={styles.subtitle}>Fields marked * are required.</p>

      <form ref={formRef} className={styles.fields} onSubmit={handleSubmit} noValidate>
        {alert && <Alert>{alert}</Alert>}
        <div className={styles.row}>
          <TextField
            label="First name"
            required
            autoComplete="given-name"
            placeholder="Giulia"
            {...bind('firstName')}
          />
          <TextField
            label="Last name"
            required
            autoComplete="family-name"
            placeholder="Rossi"
            {...bind('lastName')}
          />
        </div>
        <TextField
          label="Email"
          required
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          helper="Your booking confirmations are sent here."
          {...bind('email')}
          error={emailError}
        />
        <TextField
          label="Phone"
          type="tel"
          autoComplete="tel"
          placeholder="+39 333 123 4567"
          helper="Optional. The hut uses it only if your plans change."
          {...bind('phone')}
        />
        <div className={styles.row}>
          <TextField
            label="Password"
            required
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            {...bind('password')}
          />
          <TextField
            label="Repeat password"
            required
            type="password"
            autoComplete="new-password"
            placeholder="Same as above"
            {...bind('repeatPassword')}
          />
        </div>
        <button type="submit" className={styles.submit} disabled={submitting}>
          {submitting && <span className={styles.spinner} aria-hidden="true" />}
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}
