/**
 * HOOKS: the logout button.
 *   logout()    ends the session; on success useAuth gives user = null. Resolves to null on failure too
 *   isPending   true while waiting for the server
 *   error       ApiError or null (the user stays logged in when it fails)
 */
import { logout as logoutRequest } from '../api/auth.js';
import { useAuthRequest } from './useAuthRequest.js';

const noUser = () => null;

export function useLogout() {
  const { run, isPending, error } = useAuthRequest(logoutRequest, noUser);
  return { logout: () => run(), isPending, error };
}
