import fs from 'node:fs';
import { test as base, mergeTests } from '@playwright/test';
import { createProvider } from '@aiqa/ai-engine';
import { createHealRepository, HealingEngine, LlmStrategy } from '@aiqa/self-healing-engine';
import { loadEnv, type Env, type HealMode, type TargetName } from '@aiqa/shared';
import { trackConsoleErrors } from '../checks/console';
import { NetworkLog } from '../checks/network-log';
import { CheckoutFlow } from '../flows/checkout.flow';
import { LoginFlow } from '../flows/login.flow';
import { Healer } from '../healing/healer';
import { CartPage } from '../pages/saucedemo/cart.page';
import { CheckoutPage } from '../pages/saucedemo/checkout.page';
import { InventoryPage } from '../pages/saucedemo/inventory.page';
import { LoginPage } from '../pages/saucedemo/login.page';
import { HISTORY_DIR, TARGET_STATUS_FILE } from '../paths';

/**
 * Fixtures are this framework's dependency injection container.
 * WHY not a DI library: fixtures already give lazy creation, scoped lifetime
 * (per test or per worker) and automatic teardown, and they show up in traces.
 */

/** Options a spec can set with test.use({ ... }). */
export interface Options {
  /** Demo target this spec needs. If its health check failed, the spec is skipped, not failed. */
  targetName: TargetName | undefined;
  /** Override HEAL_MODE for one spec. */
  healMode: HealMode | undefined;
}

interface WorkerFixtures {
  env: Env;
  targetStatus: Record<string, boolean>;
}

const core = base.extend<Options & { targetGuard: void }, WorkerFixtures>({
  targetName: [undefined, { option: true }],
  healMode: [undefined, { option: true }],

  // Worker scope: parsed once per worker process, shared by every test in it.
  env: [
    async ({}, use) => {
      await use(loadEnv());
    },
    { scope: 'worker' },
  ],

  targetStatus: [
    async ({}, use) => {
      const status = fs.existsSync(TARGET_STATUS_FILE)
        ? (JSON.parse(fs.readFileSync(TARGET_STATUS_FILE, 'utf8')) as Record<string, boolean>)
        : {};
      await use(status);
    },
    { scope: 'worker' },
  ],

  // Auto fixture: runs for every test without being requested.
  targetGuard: [
    async ({ targetName, targetStatus }, use, testInfo) => {
      if (targetName && targetStatus[targetName] === false) {
        testInfo.annotations.push({ type: 'target-down', description: targetName });
        testInfo.skip(true, `target-down: ${targetName} failed its health check`);
      }
      await use();
    },
    { auto: true },
  ],
});

interface PageFixtures {
  loginPage: LoginPage;
  inventoryPage: InventoryPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
  loginFlow: LoginFlow;
  checkoutFlow: CheckoutFlow;
}

const pages = base.extend<PageFixtures>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  inventoryPage: async ({ page }, use) => use(new InventoryPage(page)),
  cartPage: async ({ page }, use) => use(new CartPage(page)),
  checkoutPage: async ({ page }, use) => use(new CheckoutPage(page)),
  loginFlow: async ({ loginPage }, use) => use(new LoginFlow(loginPage)),
  checkoutFlow: async ({ inventoryPage, cartPage, checkoutPage }, use) =>
    use(new CheckoutFlow(inventoryPage, cartPage, checkoutPage)),
});

const checks = base.extend<{ consoleErrors: string[]; networkLog: NetworkLog; slowRequestMs: number }>({
  consoleErrors: async ({ page }, use) => use(trackConsoleErrors(page)),
  /** A request slower than this is flagged in the network log. */
  slowRequestMs: [2_000, { option: true }],
  // Auto: every test keeps a network log; a failed test gets it attached, slow requests named.
  networkLog: [
    async ({ context, slowRequestMs }, use, testInfo) => {
      const log = new NetworkLog(context, slowRequestMs);
      await use(log);
      if (log.slow.length > 0) {
        testInfo.annotations.push({
          type: 'slow-requests',
          description: log.slow.map((e) => `${e.method} ${e.url} ${e.durationMs} ms`).join('; '),
        });
      }
      if (testInfo.status !== testInfo.expectedStatus && log.entries.length > 0) {
        await testInfo.attach('network-log', {
          body: JSON.stringify(log.entries, null, 2),
          contentType: 'application/json',
        });
      }
    },
    { auto: true },
  ],
});

const healing = core.extend<{ healer: Healer }>({
  healer: async ({ page, env, healMode }, use, testInfo) => {
    const repository = createHealRepository(HISTORY_DIR);
    const engine = new HealingEngine({
      threshold: env.HEAL_THRESHOLD,
      tieBreaker: env.AI_ENABLED ? new LlmStrategy(createProvider(env)) : undefined,
    });
    await use(new Healer(page, testInfo, { engine, repository, mode: healMode ?? env.HEAL_MODE }));
    repository.close();
  },
});

/** mergeTests combines independent fixture sets into the one `test` every spec imports. */
export const test = mergeTests(healing, pages, checks);
export { expect } from '@playwright/test';
