import { defineConfig } from 'vitest/config';
import path from 'node:path';

const pkg = (name: string) => path.resolve(__dirname, 'packages', name, 'src/index.ts');

export default defineConfig({
  resolve: {
    alias: {
      '@aiqa/shared': pkg('shared'),
      '@aiqa/ai-engine': pkg('ai-engine'),
      '@aiqa/self-healing-engine': pkg('self-healing-engine'),
      '@aiqa/reporting-engine': pkg('reporting-engine'),
      '@aiqa/test-data-engine': pkg('test-data-engine'),
      '@aiqa/interview-learning': pkg('interview-learning'),
      '@aiqa/ai-agents': pkg('ai-agents'),
    },
  },
  test: {
    // Unit tests only. Browser and API specs are run by Playwright.
    include: [
      'packages/{shared,ai-engine,self-healing-engine,reporting-engine,test-data-engine,interview-learning,ai-agents,mcp-server,cli,load-tests}/tests/**/*.test.ts',
      'apps/order-service/tests/**/*.test.ts',
    ],
    environment: 'node',
  },
});
