/**
 * DAO of the hikes of the hikers (table hike, MH-20). It only reads and writes rows: the rules of the
 * hut are in the use cases, and the one the database decides (two hikes of a hiker cannot overlap in
 * time) is the constraint hike_no_overlap. The departure and the return are instants (Date). A null
 * start means the hut.
 */
import { all, get, inTransaction } from './db.js';

const COLUMNS = `
  id,
  start_point AS "start",
  destination,
  route,
  passage_points AS "passagePoints",
  departure_at AS "departureAt",
  return_at AS "returnAt",
  created_at AS "createdAt"
`;

// Saves a hike. Returns the saved row, or null when its times overlap another hike of the same
// hiker (the constraint hike_no_overlap decides, so two requests at the same time cannot both
// succeed). A hike that starts when another ends does not overlap it. Any other error is thrown.
// The savepoint of inTransaction keeps a transaction around it usable after a refused hike.
export const insert = async ({
  hikerId, start, destination, route, passagePoints, departureAt, returnAt,
}) => {
  try {
    return await inTransaction(() => get(
      `
        INSERT INTO hike (hiker_id, start_point, destination, route, passage_points, departure_at, return_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING ${COLUMNS}
      `,
      [hikerId, start, destination, route, passagePoints, departureAt, returnAt],
    ));
  } catch (error) {
    if (error.constraint === 'hike_no_overlap') return null;
    throw error;
  }
};

// The hike of the hiker whose times overlap the given ones (the first by departure), or null.
// It names the hike in the way when insert() refused one.
export const findOverlapping = ({ hikerId, departureAt, returnAt }) => get(
  `
    SELECT ${COLUMNS}
    FROM hike
    WHERE hiker_id = $1 AND departure_at < $3 AND return_at > $2
    ORDER BY departure_at, id
    LIMIT 1
  `,
  [hikerId, departureAt, returnAt],
);

// All the hikes of a hiker, in order of departure.
export const findByHiker = (hikerId) => all(
  `
    SELECT ${COLUMNS}
    FROM hike
    WHERE hiker_id = $1
    ORDER BY departure_at, id
  `,
  [hikerId],
);
