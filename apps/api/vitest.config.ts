import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    // The suite talks to a real Postgres database and shares one schema, so the
    // files run one at a time. Correctness of the RBAC and consent assertions
    // matters more here than wall-clock time.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/**/*.test.ts'],
    },
  },
});
