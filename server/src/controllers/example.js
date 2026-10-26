/**
 * CONTROLLERS: here goes the HTTP adapter, one file per resource. It reads the request with the
 * dto, calls one use case (handed over by app.js), chooses the status code and answers.
 * Not here: SQL, business rules, imports from dao/, domain/ or usecases/. Domain errors are not
 * caught here: the error middleware in app.js turns them into status codes.
 *
 * THE CODE BELOW IS JUST AN EXAMPLE (story MH-01).
 * Delete this file when the first real one exists.
 */
import { parseBookTable, toBookingDto } from '../dto/bookings.js';

export const makeBookTableController = ({ bookTable }) => async (req, res) => {
  const booking = await bookTable(req.user, parseBookTable(req.body));
  res.status(201).json(toBookingDto(booking));
};
