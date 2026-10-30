/**
 * CLOCK: the only place that reads the system date. app.js hands it to the use cases, so nothing
 * else calls new Date() (ESLint forbids it in domain/ and usecases/) and a test can use a fake clock.
 * now() is the current instant; after(ms) is the instant ms milliseconds from now;
 * at(date, time, timeZone) is the instant of a wall-clock time in a time zone;
 * today(timeZone) is the day as 'YYYY-MM-DD' in a time zone;
 * localDateTime(instantMs, timeZone) writes an instant as 'YYYY-MM-DDTHH:MM' in a time zone.
 *
 * Why at(): a slot is stored as a date and a time with no time zone (the local time of the hut),
 * while now() is an instant. To compare them (booking closes 2 hours before the meal) the time of
 * the slot is turned into an instant in the time zone of the hut (HUT_TIME_ZONE, see config.js),
 * never in the time zone of the server, which can be anything (a container is usually UTC).
 */

// How far the wall clock of `timeZone` is from UTC at that instant, in milliseconds.
const offsetMs = (instantMs, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(instantMs));
  const v = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  const wallAsUtc = Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second);
  return wallAsUtc - Math.floor(instantMs / 1000) * 1000;
};

export const clock = {
  now() {
    return new Date();
  },

  after(ms) {
    return new Date(Date.now() + ms);
  },

  // date 'YYYY-MM-DD', time 'HH:MM' or 'HH:MM:SS'. The second pass corrects the offset near a DST change.
  at(date, time, timeZone) {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute, second = 0] = time.split(':').map(Number);
    const wall = Date.UTC(year, month - 1, day, hour, minute, second);
    const firstGuess = wall - offsetMs(wall, timeZone);
    return new Date(wall - offsetMs(firstGuess, timeZone));
  },

  today(timeZone) {
    // the 'en-CA' format is YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  },

  localDateTime(instantMs, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(new Date(instantMs));
    const v = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${v.year}-${v.month}-${v.day}T${v.hour}:${v.minute}`;
  },
};
