// '12:00:00' (from the database) -> '12:00'. dto/fields.js has its own toHourMinute: the layer rules
// keep dto/ away from domain/ (eslint.config.js).
export const toHourMinute = (time) => time.slice(0, 5);
