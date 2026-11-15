import { defineConfig } from 'vitest/config';
import path from 'node:path';

const pkg = (name: string) => path.resolve(__dirname, 'packages', name, 'src/index.ts');

export default defineConfig({
  resolve: {
    alias: {
      '@aiqa/shared': pkg('shared'),
      '@aiqa/ai-engine': pkg('ai-engine'),
      '@aiqa/self-healing-engine': pkg('self-healing-engine'),
    },
  },
  test: {
    // Unit tests only. Browser and API specs are run by Playwright.
    include: ['packages/{shared,ai-engine,self-healing-engine}/tests/**/*.test.ts'],
    environment: 'node',
  },
});
