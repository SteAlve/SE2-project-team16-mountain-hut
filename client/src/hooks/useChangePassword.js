/**
 * HOOKS: "Choose your password" at the first login (MH-07, docs/mockups/login screens 15-17). A hiker
 * whose account was made by the staff logs in with the password we emailed and must choose their own
 * before anything else (user.mustChangePassword). Once saved, useAuth gives the user without the
 * obligation at once, so the pages open again.
 *   save(form)       { currentPassword, newPassword, repeatPassword }; resolves to { ok },
 *                    { errors } (a field is wrong, checked here or by the server) or { status }
 *                    (401: the session ended)
 *   fieldErrors      { field: message } to show under the fields
 *   alert            message to show on top of the form, or null
 */
import { useCallback, useState } from 'react';
import { changePassword } from '../api/auth.js';
import { hasErrors, validateChangePassword } from '../lib/validateAuthForms.js';
import { useAuth } from './useAuth.js';
import { useAuthRequest } from './useAuthRequest.js';

const WRONG_CURRENT = 'The current password is wrong. Use the one we emailed you.';
const SERVER_DOWN = 'Something went wrong on our side. Try again in a minute.';

// The server answers 204 (null): turn it into true, so success and failure resolve differently.
const call = (input) => changePassword(input).then(() => true);

export function useChangePassword() {
  const { user } = useAuth();
  const userAfter = useCallback(() => ({ ...user, mustChangePassword: false }), [user]);
  const { run, isPending, lastError } = useAuthRequest(call, userAfter);
  const [fieldErrors, setFieldErrors] = useState({});
  const [alert, setAlert] = useState(null);

  const save = async ({ currentPassword, newPassword, repeatPassword }) => {
    const errors = validateChangePassword({ currentPassword, newPassword, repeatPassword });
    setFieldErrors(errors);
    setAlert(null);
    if (hasErrors(errors)) return { errors };

    if (await run({ currentPassword, newPassword })) return { ok: true };

    const status = lastError.current?.status;
    // The new password differs from the current one typed (checked above), so a 422 can only say
    // that the current one is wrong.
    if (status === 422) {
      const wrong = { currentPassword: WRONG_CURRENT };
      setFieldErrors(wrong);
      return { errors: wrong };
    }
    if (status !== 401) setAlert(SERVER_DOWN);
    return { status };
  };

  const clearFieldError = (name) => setFieldErrors(({ [name]: _cleared, ...rest }) => rest);

  return { save, submitting: isPending, fieldErrors, alert, clearFieldError };
}
