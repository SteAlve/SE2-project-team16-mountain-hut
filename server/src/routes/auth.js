/**
 * Routes of the authentication. Only `me` needs a login: sign up, login and logout are open
 * (logout of a visitor who is not logged in is not an error).
 */
import { Router } from 'express';

export const makeAuthRouter = ({
  registerController,
  loginController,
  logoutController,
  meController,
  requireAuth,
}) => {
  const router = Router();
  router.post('/auth/register', registerController);
  router.post('/auth/login', loginController);
  router.post('/auth/logout', logoutController);
  router.get('/auth/me', requireAuth, meController);
  return router;
};
