/**
 * Controller of the hikes (MH-20). requireAuth has already put the logged-in user in req.user.
 */
import { parseRegisterHike, toHikeDto } from '../dto/hikes.js';

// POST /api/hikes: the hiker registers a hike; the answer is the saved hike.
export const makeRegisterHikeController = ({ registerHikeAndNotify }) => async (req, res) => {
  const input = parseRegisterHike(req.body);
  const hike = await registerHikeAndNotify({ user: req.user, ...input });
  res.status(201).json(toHikeDto(hike));
};

// GET /api/hikes: the hikes of the logged-in hiker, in order of departure.
export const makeListMyHikesController = ({ listMyHikes }) => async (req, res) => {
  const hikes = await listMyHikes({ user: req.user });
  res.status(200).json(hikes.map(toHikeDto));
};
