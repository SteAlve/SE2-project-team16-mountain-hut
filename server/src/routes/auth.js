/**
 * Routes of the authentication. Sign up, login and logout are open (logout of a visitor who is not
 * logged in is not an error), and so are the two steps of the password reset (MH-07): the visitor
 * who forgot the password cannot log in. `me` and the change of the password need a login, but not
 * a changed password (`requireLogin`): they are what a hiker who has to change the generated
 * password can still do.
 */
import { Router } from 'express';

export const makeAuthRouter = ({
  registerController,
  loginController,
  logoutController,
  meController,
  changePasswordController,
  requestPasswordResetController,
  resetPasswordController,
  requireLogin,
}) => {
  const router = Router();
  router.post('/auth/register', registerController);
  router.post('/auth/login', loginController);
  router.post('/auth/logout', logoutController);
  router.get('/auth/me', requireLogin, meController);
  router.post('/auth/change-password', requireLogin, changePasswordController);
  router.post('/auth/password-reset-requests', requestPasswordResetController);
  router.post('/auth/password-resets', resetPasswordController);
  return router;
};
