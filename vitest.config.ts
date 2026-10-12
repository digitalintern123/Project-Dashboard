import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    include: ['server/test/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['server/test/setup-env.ts'],
    pool: 'forks',
  },
});
