/**
 * ROUTE GUARD: shows `children` only to a logged-in user whose role is in `roles`.
 *   Nobody logged in   -> the login, with "Log in to <page>." and back here after login
 *   Another role       -> `denied` (e.g. the Staff only page), or that role's start page
 * Only convenience: the server checks the session and the role again on every request.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { START_PAGE } from '../lib/roles.js';

export function RequireRole({ roles, page, denied, children }) {
  const { user, isLoading } = useAuth();
  const { pathname } = useLocation();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: pathname, page }} />;
  if (!roles.includes(user.role)) {
    return denied ?? <Navigate to={START_PAGE[user.role]?.path ?? '/'} replace />;
  }
  return children;
}
