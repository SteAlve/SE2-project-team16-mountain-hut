/**
 * HOOKS: the password reset by email (MH-07, docs/mockups/login screens 10-14). Open pages: the user
 * who forgot the password is not logged in.
 *
 * useForgotPassword()         "Forgot your password?" and "Check your email" (screens 10-11)
 *   send(email)               asks for the link; resolves to { ok } or { errors }
 *   sentTo                    the email the link was asked for, once asked (the page then says
 *                             "Check your email"), or null
 *   isPending, fieldErrors, alert, clearFieldError
 *
 * useResetPassword(token)     "Choose a new password" from the link (screens 12-13)
 *   email                     the email of the reset, when this browser asked for it, or null
 *   save(form)                { newPassword, repeatPassword }; resolves to { ok, email } (the password
 *                             is changed: the page goes to the login) or { errors }
 *   linkNotValid              true when the link does not work (expired, used, replaced, or no token)
 *   isPending, fieldErrors, alert, clearFieldError
 */
import { useState } from 'react';
import { requestPasswordReset, resetPassword } from '../api/auth.js';
import { hasErrors, validateForgotPassword, validateNewPassword } from '../lib/validateAuthForms.js';
import { forgetResetEmail, rememberResetEmail, rememberedResetEmail } from './resetEmail.js';

const SERVER_DOWN = 'Something went wrong on our side. Try again in a minute.';

function useFormState() {
  const [isPending, setIsPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [alert, setAlert] = useState(null);
  const clearFieldError = (name) => setFieldErrors(({ [name]: _cleared, ...rest }) => rest);
  return { isPending, setIsPending, fieldErrors, setFieldErrors, alert, setAlert, clearFieldError };
}

export function useForgotPassword() {
  const { setIsPending, setFieldErrors, setAlert, ...form } = useFormState();
  const [sentTo, setSentTo] = useState(null);

  const send = async (typed) => {
    const errors = validateForgotPassword({ email: typed });
    setFieldErrors(errors);
    setAlert(null);
    if (hasErrors(errors)) return { errors };

    const email = typed.trim();
    setIsPending(true);
    try {
      await requestPasswordReset(email);
      rememberResetEmail(email);
      setSentTo(email);
      return { ok: true };
    } catch {
      // The answer is the same whether the email has an account or not: only a failure is said.
      setAlert(SERVER_DOWN);
      return { ok: false };
    } finally {
      setIsPending(false);
    }
  };

  return { ...form, send, sentTo };
}

export function useResetPassword(token) {
  const { setIsPending, setFieldErrors, setAlert, ...form } = useFormState();
  const [email] = useState(rememberedResetEmail);
  // Without a token the link is surely not valid. Any other link is found out at Save password:
  // the server has no call to check it before.
  const [linkNotValid, setLinkNotValid] = useState(!token);

  const save = async ({ newPassword, repeatPassword }) => {
    const errors = validateNewPassword({ newPassword, repeatPassword });
    setFieldErrors(errors);
    setAlert(null);
    if (hasErrors(errors)) return { errors };

    setIsPending(true);
    try {
      await resetPassword({ token, newPassword });
      forgetResetEmail();
      return { ok: true, email };
    } catch (error) {
      if (error.status === 422) setLinkNotValid(true);
      else setAlert(SERVER_DOWN);
      return { ok: false };
    } finally {
      setIsPending(false);
    }
  };

  return { ...form, email, save, linkNotValid };
}
