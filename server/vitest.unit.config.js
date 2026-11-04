import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/usecases/*.test.js'],
    fileParallelism: false,
  },
});
