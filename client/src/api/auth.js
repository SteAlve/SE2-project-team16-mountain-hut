/**
 * API: authentication endpoints, one function per endpoint (see docs/openapi.json, tag "Auth").
 * The session lives in an HttpOnly cookie that the browser sends by itself: nothing to store here.
 */
import { request } from './request.js';

// Self-registration is only for hikers: the server sets the role. Resolves to the new user.
export const register = ({ firstName, lastName, email, phone, password }) =>
  request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ firstName, lastName, email, phone, password }),
  });

// The same call for every role. Resolves to the user.
export const login = ({ email, password }) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

// Resolves to null (204).
export const logout = () => request('/auth/logout', { method: 'POST' });

// The user of the current session. Rejects with ApiError 401 when nobody is logged in.
export const getCurrentUser = () => request('/auth/me');
