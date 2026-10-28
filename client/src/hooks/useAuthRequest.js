/**
 * HOOKS: the common steps of login, sign up and logout (internal, pages do not use it):
 * call the server, track pending and error, and tell the app who is logged in.
 * `run` never rejects: a failure ends in `error` (an ApiError) and `run` resolves to null.
 */
import { useCallback, useContext, useState } from 'react';
import { AuthContext } from './AuthProvider.js';

export function useAuthRequest(call, userAfter) {
  const context = useContext(AuthContext);
  if (!context) throw new Error('This hook must be used inside <AuthProvider>');
  const { setUser } = context;
  const [state, setState] = useState({ isPending: false, error: null });

  const run = useCallback(
    async (input) => {
      setState({ isPending: true, error: null });
      try {
        const result = await call(input);
        setUser(userAfter ? userAfter(result) : result);
        setState({ isPending: false, error: null });
        return result;
      } catch (error) {
        setState({ isPending: false, error });
        return null;
      }
    },
    [call, userAfter, setUser],
  );

  return { ...state, run };
}
