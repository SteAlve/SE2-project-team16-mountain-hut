/**
 * Use case: register a hike (registerHike) and send the hiker the details by email (MH-20).
 *
 * The email leaves only for a hike that was saved: a refused registration (missing information,
 * overlap) throws before this point and sends nothing. As for a booking, a failed email is only
 * written to the log: the hike stands.
 */
import { hikeRegisteredEmail } from '../domain/hikeRegisteredEmail.js';

export const makeRegisterHikeAndNotify = ({ registerHike, mailer }) => async (input) => {
  const hike = await registerHike(input);

  try {
    const { email, firstName, lastName } = input.user;
    await mailer.send(hikeRegisteredEmail({ email, firstName, lastName, ...hike }));
  } catch (error) {
    console.error(`The email about hike ${hike.id} was not sent:`, error);
  }

  return hike;
};
