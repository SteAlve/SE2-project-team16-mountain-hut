/**
 * Routes of the hikes (MH-20). They need a logged-in user (which role may register a hike is
 * decided by the use case).
 */
import { Router } from 'express';

export const makeHikesRouter = ({ registerHikeController, listMyHikesController, requireAuth }) => {
  const router = Router();
  router.post('/hikes', requireAuth, registerHikeController);
  router.get('/hikes', requireAuth, listMyHikesController);
  return router;
};
