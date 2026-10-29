/**
 * HOOKS: keeps who is logged in for the whole app. <App /> wraps the router in <AuthProvider>,
 * so every page sees the same user. At start it asks the server who the session belongs to.
 * The pages do not use this file: they use useAuth, useLogin, useRegister and useLogout.
 */
import { createContext, createElement, useEffect, useMemo, useState } from 'react';
import { getCurrentUser } from '../api/auth.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, isLoading: true });

  useEffect(() => {
    let ignore = false;
    // Any failure at start (401 or server down) means "nobody is logged in".
    getCurrentUser().then(
      (user) => !ignore && setState({ user, isLoading: false }),
      () => !ignore && setState({ user: null, isLoading: false }),
    );
    return () => {
      ignore = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      setUser: (user) => setState({ user, isLoading: false }),
    }),
    [state],
  );

  return createElement(AuthContext, { value }, children);
}
