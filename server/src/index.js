/**
 * INDEX: the entry point, the only file that starts the server (npm start runs it).
 * Not here: routes, wiring, logic (that is app.js). Tests import `app` without opening a port.
 */
import { app } from './app.js';

const port = process.env.PORT ?? 3001;
const server = app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
