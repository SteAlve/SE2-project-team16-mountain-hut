/**
 * HOOKS: the sign-up page. Checks the fields, then creates the hiker account through
 * useAuthRequest, so the new user is logged in and available from useAuth at once.
 *   submit(form)   resolves to { user } on success, { errors } when a field is wrong,
 *                  or { status } when the server refuses (409: the email is already registered)
 *   fieldErrors    { field: message } to show under the fields; email may be EMAIL_TAKEN
 *   alert          message to show on top of the form, or null
 */
import { useState } from 'react';
import { register as registerRequest } from '../api/auth.js';
import { hasErrors, validateSignUp } from '../lib/validateAuthForms.js';
import { useAuthRequest } from './useAuthRequest.js';

// The page draws this error with a "Log in" link.
export const EMAIL_TAKEN = 'EMAIL_TAKEN';
const SERVER_DOWN = 'Something went wrong on our side. Try again in a minute.';

export function useSignUpForm() {
  const { run, isPending, lastError } = useAuthRequest(registerRequest);
  const [fieldErrors, setFieldErrors] = useState({});
  const [alert, setAlert] = useState(null);

  const submit = async (form) => {
    const errors = validateSignUp(form);
    setFieldErrors(errors);
    setAlert(null);
    if (hasErrors(errors)) return { errors };

    const user = await run({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      password: form.password,
    });
    if (user) return { user };

    const status = lastError.current?.status;
    if (status === 409) setFieldErrors({ email: EMAIL_TAKEN });
    else setAlert(SERVER_DOWN);
    return { status };
  };

  const clearFieldError = (name) => setFieldErrors(({ [name]: _cleared, ...rest }) => rest);

  return { submit, submitting: isPending, fieldErrors, alert, clearFieldError };
}
