/**
 * API: the hikes of a hiker, one function per endpoint (see docs/openapi.json, tag "Hikes", story MH-20).
 * Needs a logged-in hiker: the session cookie is sent by the browser.
 */
import { request } from './request.js';

// Registers a planned hike (MH-20): `start` (optional: without it the hike starts at the hut), `destination`, `route`,
// `passagePoints` (in order, maybe empty), and the planned `departureAt` and expected `returnAt`, both
// 'YYYY-MM-DDTHH:MM' in the hut's time.
// Resolves to the saved hike { id, start, destination, route, passagePoints, departureAt, returnAt }; the server also
// emails the hiker, and a failed email does not undo the hike.
// Rejects with ApiError 400 (wrong data, a departure in the past, or a return not after the departure), 401 (not logged
// in), 403 (not a hiker) or 409 with code HIKE_OVERLAP (the times overlap another hike of the hiker; `details.hike` says
// which one).
export const registerHike = ({ start, destination, route, passagePoints, departureAt, returnAt }) =>
  request('/hikes', {
    method: 'POST',
    // A `start` left undefined is not in the JSON: the server starts the hike at the hut.
    body: JSON.stringify({ start, destination, route, passagePoints, departureAt, returnAt }),
  });

// The hikes of the logged-in hiker, in order of departure, the past ones too. Resolves to
// [{ id, start, destination, route, passagePoints, departureAt, returnAt }]; `start` is null for the hut.
// Rejects with ApiError 401 (not logged in) or 403 (not a hiker).
export const listMyHikes = () => request('/hikes');
