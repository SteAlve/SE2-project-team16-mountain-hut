import { defineConfig } from 'vitest/config';

// The tests always use TEST_DATABASE_URL (see src/config.js). Set before anything reads the config,
// also in the process that runs globalSetup, so the migrations go to the test database.
process.env.NODE_ENV = 'test';

export default defineConfig({
  test: {
    // Applies the SQL migrations to the test database before any test runs.
    globalSetup: ['./test/globalSetup.js'],
    // Test files share one database: run them one after the other.
    fileParallelism: false,
  },
});
