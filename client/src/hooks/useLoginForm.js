/**
 * HOOKS: the login page. Checks the fields, then logs in through useAuthRequest, so on success
 * the user is available from useAuth at once.
 *   submit(credentials)  resolves to { user } on success, { errors } when a field is wrong,
 *                        or { status } when the server refuses (401: wrong email or password)
 *   fieldErrors          { field: message } to show under the fields
 *   alert                message to show on top of the form, or null
 */
import { useCallback, useRef, useState } from 'react';
import { login as loginRequest } from '../api/auth.js';
import { hasErrors, validateLogIn } from '../lib/validateAuthForms.js';
import { useAuthRequest } from './useAuthRequest.js';

const WRONG_CREDENTIALS = 'The email or password is wrong. Try again.';
const SERVER_DOWN = 'Something went wrong on our side. Try again in a minute.';

export function useLoginForm() {
  // useAuthRequest resolves to null on failure: keep the error to tell a 401 from the rest.
  const failure = useRef(null);
  const call = useCallback(async (credentials) => {
    try {
      return await loginRequest(credentials);
    } catch (error) {
      failure.current = error;
      throw error;
    }
  }, []);
  const { run, isPending } = useAuthRequest(call);
  const [fieldErrors, setFieldErrors] = useState({});
  const [alert, setAlert] = useState(null);

  const submit = async (credentials) => {
    const errors = validateLogIn(credentials);
    setFieldErrors(errors);
    setAlert(null);
    if (hasErrors(errors)) return { errors };

    const user = await run({ ...credentials, email: credentials.email.trim() });
    if (user) return { user };

    const status = failure.current?.status;
    setAlert(status === 401 ? WRONG_CREDENTIALS : SERVER_DOWN);
    return { status };
  };

  const clearFieldError = (name) => setFieldErrors(({ [name]: _cleared, ...rest }) => rest);

  return { submit, submitting: isPending, fieldErrors, alert, clearFieldError };
}
