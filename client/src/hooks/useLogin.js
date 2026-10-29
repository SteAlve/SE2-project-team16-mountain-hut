/**
 * HOOKS: the login form (the same for hikers, employees and the warden).
 *   login({ email, password })  resolves to the user, or to null when it failed
 *   isPending                   true while waiting for the server
 *   error                       ApiError or null. 401: wrong email or password; 400: missing field
 * On success the user is available from useAuth at once.
 */
import { login as loginRequest } from '../api/auth.js';
import { useAuthRequest } from './useAuthRequest.js';

export function useLogin() {
  const { run, isPending, error } = useAuthRequest(loginRequest);
  return { login: run, isPending, error };
}
