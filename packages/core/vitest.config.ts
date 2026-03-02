import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@agents': resolve(__dirname, 'src/agents'),
      '@ai': resolve(__dirname, 'src/ai'),
      '@browser': resolve(__dirname, 'src/browser'),
      '@config': resolve(__dirname, 'src/config'),
      '@executor': resolve(__dirname, 'src/executor'),
      '@suite': resolve(__dirname, 'src/suite'),
      '@domain': resolve(__dirname, 'src/domain'),
      '@cli': resolve(__dirname, 'src/cli'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
});
