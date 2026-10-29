/**
 * CLOCK: the only place that reads the system date. app.js hands it to the use cases, so nothing
 * else calls new Date() (ESLint forbids it in domain/ and usecases/) and a test can use a fake clock.
 * now() is the current instant; after(ms) is the instant ms milliseconds from now;
 * today() is the day as 'YYYY-MM-DD' in the local time of the server.
 */
export const clock = {
  now() {
    return new Date();
  },

  after(ms) {
    return new Date(Date.now() + ms);
  },

  today() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },
};
