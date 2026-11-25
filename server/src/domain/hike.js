/**
 * The hikes that a hiker registers (MH-20). A hike has a destination, a route (a text), the passage
 * points in order and a departure and an expected return. The hut does not store the start: it is
 * always the hut.
 *
 * Pure functions. The times of the database are instants, while the API speaks in the local time of
 * the hut: 'YYYY-MM-DDTHH:MM'. The use cases turn the one into the other with the clock, and hand the
 * conversion in as `toLocal`.
 */

// A hike as the API shows it, from a row of the database. `toLocal` writes an instant (Date) as the
// local date and time of the hut.
export const describeHike = (hike, toLocal) => ({
  id: hike.id,
  destination: hike.destination,
  route: hike.route,
  passagePoints: hike.passagePoints,
  departureAt: toLocal(hike.departureAt),
  returnAt: toLocal(hike.returnAt),
});

// 'YYYY-MM-DDTHH:MM' -> { date: 'YYYY-MM-DD', time: 'HH:MM' }, for the clock that turns it into an instant.
export const splitLocalDateTime = (localDateTime) => {
  const [date, time] = localDateTime.split('T');
  return { date, time };
};
