/**
 * API: here goes the code that talks to the server, one function per endpoint, built on request().
 * Not here: React, state, formatting.
 *
 * THE CODE BELOW IS JUST AN EXAMPLE (story MH-01: a hiker books a table).
 * Delete this file when the first real one exists.
 */
import { request } from './request.js';

export const bookTable = ({ slotId, partySize }) =>
  request('/bookings', { method: 'POST', body: JSON.stringify({ slotId, partySize }) });
