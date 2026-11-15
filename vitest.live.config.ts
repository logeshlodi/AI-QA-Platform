import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config';

// Tests that talk to a real local model. Run with:  AI_ENABLED=true pnpm test:ai
export default mergeConfig(
  { ...base, test: undefined },
  defineConfig({
    test: {
      include: ['packages/*/tests/**/*.live.ts'],
      environment: 'node',
      testTimeout: 400_000,
      fileParallelism: false,
    },
  }),
);
