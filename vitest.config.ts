import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 15000,
    // The CLI tests chdir into per-test tmp dirs. Multiple workers running in
    // parallel will trample each other's process.cwd() — keep them serial.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // index.ts is just a re-export barrel; covering it adds noise without
      // exercising real logic. The bin entry is a thin shell over the CLI
      // and is exercised end-to-end via the CLI integration tests.
      exclude: ['src/index.ts', 'src/bin/**'],
      reporter: ['text', 'json', 'html', 'lcov'],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 80,
      },
    },
  },
});
