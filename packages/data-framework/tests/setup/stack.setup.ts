import { test as setup, expect } from '@playwright/test';
import { stack } from '../../src/stack';

// Fails fast, with the fix in the message, when the Docker stack is not running.
setup('the order service and its stack are up', async ({ request }) => {
  await expect
    .poll(
      async () => {
        try {
          return (await request.get(`${stack.serviceUrl}/health`, { timeout: 3_000 })).status();
        } catch {
          return 0;
        }
      },
      {
        message: `order service not ready at ${stack.serviceUrl}/health. Start the stack: npx pnpm stack:up`,
        timeout: 60_000,
      },
    )
    .toBe(200);
});
