import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'test/usecases/*.test.js',
      'test/domain/bookingCancelledEmail.test.js',
      'test/dto/cancelBooking.test.js',
    ],
    fileParallelism: false,
  },
});
