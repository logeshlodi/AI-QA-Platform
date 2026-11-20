import path from 'node:path';
import { defineConfig } from 'vitest/config';

const service = (file: string) => path.resolve(__dirname, '../../apps/order-service/src', file);

export default defineConfig({
  resolve: {
    alias: {
      '@aiqa/order-service/config': service('config.ts'),
      '@aiqa/order-service/events': service('events.ts'),
      '@aiqa/data-framework/auth': path.resolve(__dirname, '../data-framework/src/auth.ts'),
    },
  },
  test: {
    environment: 'node',
    // Pact's core reports anonymous usage statistics unless told not to.
    env: { PACT_DO_NOT_TRACK: 'true' },
    projects: [
      {
        extends: true,
        test: {
          name: 'consumer',
          include: ['tests/consumer/**/*.test.ts'],
          // Start from empty pact files, so an interaction a consumer no longer has cannot linger.
          globalSetup: [path.resolve(__dirname, 'tests/consumer/clean-pacts.ts')],
        },
      },
      {
        extends: true,
        test: {
          name: 'provider',
          include: ['tests/provider/**/*.test.ts'],
          testTimeout: 180_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
