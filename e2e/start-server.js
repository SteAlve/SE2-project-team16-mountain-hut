// Starts the server for the E2E tests on port 3001, where the client sends its /api requests.
// Playwright runs this file by itself (see playwright.config.js).

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const serverDir = fileURLToPath(new URL('../server/', import.meta.url));
const serverEnv = { ...process.env, PORT: '3001' };

if (process.env.E2E_DATABASE_URL) {
  serverEnv.DATABASE_URL = process.env.E2E_DATABASE_URL;
}

const server = spawn(process.execPath, ['src/index.js'], {
  cwd: serverDir,
  stdio: 'inherit',
  env: serverEnv,
});

// When Playwright stops this script, the server stops with it.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.kill(signal));
}
server.on('exit', (code) => process.exit(code ?? 0));
