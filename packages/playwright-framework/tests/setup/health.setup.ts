import fs from 'node:fs';
import path from 'node:path';
import { test as setup } from '@playwright/test';
import { resolveTarget, targetNames } from '@aiqa/shared';
import { TARGET_STATUS_FILE } from '../../src/paths';

/**
 * Global setup as a project (so it appears in the report and the trace).
 * Pings every demo target and records which are up. A target that is down makes
 * its specs SKIP with a "target-down" annotation instead of failing: "the site
 * is unreachable" and "the product is broken" are different findings.
 */
setup('health-check every demo target', async ({ request }) => {
  setup.setTimeout(150_000);

  const ping = async (name: (typeof targetNames)[number]): Promise<boolean> => {
    const target = resolveTarget(name);
    // Hosted demo apps can be slow to wake, so try a few times before giving up.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await request.get(`${target.baseUrl}${target.healthPath}`, { timeout: 30_000 });
        if (target.okStatus.includes(response.status())) return true;
      } catch {
        // network error: retry
      }
    }
    return false;
  };

  const results = await Promise.all(targetNames.map(async (name) => [name, await ping(name)] as const));
  const status = Object.fromEntries(results);
  fs.mkdirSync(path.dirname(TARGET_STATUS_FILE), { recursive: true });
  fs.writeFileSync(TARGET_STATUS_FILE, JSON.stringify(status, null, 2));

  for (const [name, up] of results) {
    setup.info().annotations.push({ type: up ? 'target-up' : 'target-down', description: name });
  }
});
