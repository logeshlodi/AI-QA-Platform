import fs from 'node:fs';
import path from 'node:path';
import { request, test as base, type APIRequestContext } from '@playwright/test';
import { z } from 'zod';

/** infrastructure/environments.json: each place the order service runs, as the host reaches it. */
export const ENVIRONMENTS_FILE = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'infrastructure',
  'environments.json',
);

const environmentSchema = z.object({
  label: z.string(),
  serviceUrl: z.url(),
  metricsUrl: z.url(),
});
export type Environment = z.infer<typeof environmentSchema> & { name: string };

export function readEnvironments(file = ENVIRONMENTS_FILE): Environment[] {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  return Object.entries(raw)
    .filter(([name]) => !name.startsWith('$'))
    .map(([name, value]) => ({ name, ...environmentSchema.parse(value) }));
}

/**
 * The matrix's fixtures: each Playwright project sets `environment`, and every test in it talks to
 * that environment only. An environment that does not answer its health check skips its tests with
 * the reason, so a matrix run with one environment down still reports the others.
 */
export const test = base.extend<
  { service: APIRequestContext; environmentGuard: void },
  { environment: Environment; reachable: boolean }
>({
  environment: [undefined as unknown as Environment, { option: true, scope: 'worker' }],
  reachable: [
    async ({ environment }, use) => {
      const probe = await request.newContext({ baseURL: environment.serviceUrl, timeout: 5_000 });
      const ok = await probe
        .get('/health')
        .then((r) => r.ok())
        .catch(() => false);
      await probe.dispose();
      await use(ok);
    },
    { scope: 'worker' },
  ],
  // Auto: every test, whatever fixtures it uses, is labelled with its environment and skipped when
  // that environment is down.
  environmentGuard: [
    async ({ environment, reachable }, use, testInfo) => {
      testInfo.annotations.push({
        type: 'environment',
        description: `${environment.name}: ${environment.label}`,
      });
      testInfo.skip(
        !reachable,
        `environment-down: ${environment.name} (${environment.serviceUrl}) did not answer /health`,
      );
      await use();
    },
    { auto: true },
  ],
  service: async ({ environment }, use) => {
    const ctx = await request.newContext({ baseURL: environment.serviceUrl });
    await use(ctx);
    await ctx.dispose();
  },
});
export { expect } from '@playwright/test';
