/**
 * CONFIG: every setting read from the environment, in one place. app.js, index.js and dao/db.js
 * read it from here; nothing else touches process.env.
 *
 * Where the values come from, in order of priority:
 *   1. the real environment (the run configuration of the IDE, CI, Docker...)
 *   2. server/.env, a personal file that is never committed (copy server/.env.example to start)
 *
 *   DATABASE_URL       the PostgreSQL database of the server. When NODE_ENV is 'test' the server
 *                      uses TEST_DATABASE_URL instead, so a test never touches your data.
 *   TEST_DATABASE_URL  the PostgreSQL database of the tests
 *   PORT               the port of the server (default 3001)
 *   SESSION_TTL_HOURS  how long a login lasts (default 24)
 *   COOKIE_SECURE      'true' only when the site is served over HTTPS: a Secure cookie is
 *                      dropped by the browser on plain http, so the login would not work
 *
 * The database URL may be missing: the error comes when something really connects (dao/db.js),
 * so the tests that do not need a database still run.
 */
import { fileURLToPath } from 'node:url';

// loadEnvFile never overrides a variable that is already set, so the real environment wins.
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch (error) {
  if (error.code !== 'ENOENT') throw error; // no .env file is fine
}

const ttlHours = Number(process.env.SESSION_TTL_HOURS ?? 24);

if (!Number.isFinite(ttlHours) || ttlHours <= 0) {
  throw new Error('SESSION_TTL_HOURS must be a positive number.');
}

const hutTimeZone = process.env.HUT_TIME_ZONE ?? 'Europe/Rome';

try {
  new Intl.DateTimeFormat('en-US', { timeZone: hutTimeZone });
} catch {
  throw new Error('HUT_TIME_ZONE must be a valid time zone name, for example Europe/Rome.');
}

const databaseUrlVariable = process.env.NODE_ENV === 'test' ? 'TEST_DATABASE_URL' : 'DATABASE_URL';

export const config = {
  databaseUrlVariable,
  databaseUrl: process.env[databaseUrlVariable],
  port: Number(process.env.PORT ?? 3001),
  sessionCookieName: 'sid',
  sessionTtlMs: ttlHours * 60 * 60 * 1000,
  cookieSecure: process.env.COOKIE_SECURE === 'true',
};
