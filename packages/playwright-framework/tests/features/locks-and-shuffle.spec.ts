import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { expect, test } from '../../src/fixtures';

/**
 * Test locks: tests that share a lock name never run at the same time, even in
 * different files or projects, while everything else stays parallel. Use one for a
 * resource that cannot take two writers: a shared account, a settings page, a file.
 * The built-in '-exclusive-' lock goes further and runs a test only when no other test is running.
 *
 * --shuffle: `pnpm test:shuffle` runs files and parallel tests in a random order and prints
 * the seed; `pnpm test:shuffle 1234` replays that order. Tests that pass only in file order
 * have a hidden dependency on each other, and shuffling is how you find them.
 */
const MARKER = path.join(os.tmpdir(), 'aiqa-lock-demo.marker');
const STALE_MS = 30_000;

/** Stands in for a resource with room for one user: creating the marker fails if someone else holds it. */
async function useSharedResource(): Promise<void> {
  if (fs.existsSync(MARKER) && Date.now() - fs.statSync(MARKER).mtimeMs > STALE_MS) {
    fs.rmSync(MARKER, { force: true }); // left behind by a run that was killed
  }
  fs.closeSync(fs.openSync(MARKER, 'wx')); // 'wx' throws EEXIST when the marker is already there
  try {
    // review-ok: holds the shared resource long enough for a second test to collide
    await sleep(400);
  } finally {
    fs.rmSync(MARKER, { force: true });
  }
}

test.describe('test locks', { tag: '@lab' }, () => {
  test.describe.configure({ mode: 'parallel' });

  for (const writer of ['first', 'second', 'third']) {
    test(
      `the ${writer} writer gets the shared resource to itself`,
      { lock: 'shared-report-file' },
      async () => {
        // Remove the lock and these collide whenever two workers run them together.
        await expect(useSharedResource()).resolves.toBeUndefined();
      },
    );
  }
});
