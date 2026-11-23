import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test as teardown } from '@playwright/test';
import { TARGET_STATUS_FILE } from '../../src/paths';

/**
 * Global teardown as a project: the `setup` project names it (`teardown: 'cleanup'`), so it runs once
 * after every project that depends on setup has finished, pass or fail, and shows in the report.
 *
 * The health check's results describe one run. Left behind, a later run started with --no-deps would
 * skip specs because of a site that was down yesterday, so they are attached to this run's report and
 * then removed. Scratch files a killed run can leave are removed too.
 */
teardown('record which targets were down, then clear this run’s state', async ({}, testInfo) => {
  if (fs.existsSync(TARGET_STATUS_FILE)) {
    const status = JSON.parse(fs.readFileSync(TARGET_STATUS_FILE, 'utf8')) as Record<string, boolean>;
    const down = Object.entries(status)
      .filter(([, up]) => !up)
      .map(([name]) => name);
    await testInfo.attach('target health', {
      body: JSON.stringify(status, null, 2),
      contentType: 'application/json',
    });
    if (down.length > 0) testInfo.annotations.push({ type: 'targets-down', description: down.join(', ') });
    fs.rmSync(TARGET_STATUS_FILE, { force: true });
  }
  fs.rmSync(path.join(os.tmpdir(), 'aiqa-lock-demo.marker'), { force: true }); // locks-and-shuffle.spec.ts
});
