/**
 * HOOKS: the logout button.
 *   logout()    ends the session; on success useAuth gives user = null. Resolves to true on success,
 *               to null on failure
 *   isPending   true while waiting for the server
 *   error       ApiError or null (the user stays logged in when it fails)
 */
import { logout as logoutRequest } from '../api/auth.js';
import { useAuthRequest } from './useAuthRequest.js';

// The server answers 204 (null): turn it into true, so success and failure resolve differently.
const call = () => logoutRequest().then(() => true);
const noUser = () => null;

export function useLogout() {
  const { run, isPending, error } = useAuthRequest(call, noUser);
  return { logout: () => run(), isPending, error };
}
