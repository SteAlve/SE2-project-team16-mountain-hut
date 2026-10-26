/**
 * THIS IS JUST A PLACEHOLDER.
 *
 * DB: the only file that knows which database we use (PostgreSQL). Implemented with the database task.
 * It will export get(sql, params), all(sql, params), run(sql, params) and inTransaction(fn), all async.
 * The dao files use the first three; the dao functions called inside inTransaction take part in it.
 * Not here: queries about hikers, slots or bookings (the other dao files), business rules, HTTP.
 */

const notImplemented = () => {
  throw new Error('dao/db.js is a placeholder: implement it with the database task.');
};

export const get = notImplemented;
export const all = notImplemented;
export const run = notImplemented;
export const inTransaction = notImplemented;
