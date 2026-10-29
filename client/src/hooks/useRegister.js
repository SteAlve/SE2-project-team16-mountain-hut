/**
 * HOOKS: the sign-up form of a hiker. The new account is logged in at once.
 *   register({ firstName, lastName, email, phone, password })  resolves to the user, or null
 *   isPending                                                  true while waiting for the server
 *   error                                                      ApiError or null. 409: email taken; 400: invalid field
 * `phone` is optional. The error message comes from the server and is fit to show.
 */
import { register as registerRequest } from '../api/auth.js';
import { useAuthRequest } from './useAuthRequest.js';

export function useRegister() {
  const { run, isPending, error } = useAuthRequest(registerRequest);
  return { register: run, isPending, error };
}
