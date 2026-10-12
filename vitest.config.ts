import { defineConfig } from 'vitest/config';
import path from 'node:path';

const alias = { '@': path.resolve(__dirname, './src') };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'server',
          include: ['server/test/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['server/test/setup-env.ts'],
          pool: 'forks',
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'unit',
          env: { TZ: 'Asia/Kolkata' },
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'web',
          include: ['src/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['src/test/setup-dom.ts'],
          env: { TZ: 'Asia/Kolkata' },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['server/src/**/*.ts'],
      // Process bootstrap and one-off CLI/seed scripts are exercised by E2E and
      // operations, not unit tests.
      exclude: ['server/src/index.ts', 'server/src/scripts/**'],
      thresholds: { lines: 80, statements: 80, functions: 75, branches: 65 },
    },
  },
});
