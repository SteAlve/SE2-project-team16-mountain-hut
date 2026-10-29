/**
 * HOOKS: who is logged in. Use it in any page, below <AuthProvider>.
 *   user            the user { id, firstName, lastName, email, phone, role }, or null
 *   isLoading       true until the server has answered at start: do not redirect before that
 *   isAuthenticated true when there is a user
 * The server decides what each role may do: this is only to show or hide things.
 */
import { useContext } from 'react';
import { AuthContext } from './AuthProvider.js';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');

  const { user, isLoading } = context;
  return { user, isLoading, isAuthenticated: user !== null };
}
