import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    // Browser Lab owns a separate package, dependencies and Node test runner.
    // Keep its tests in the worker CI job, not the root application test suite.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
