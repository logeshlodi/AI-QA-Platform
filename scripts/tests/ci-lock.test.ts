import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
// @ts-expect-error -- a plain ESM script with no type declarations
import { lockFile, readLock, release, tryAcquire } from '../ci-lock.mjs';

type Result = { ok: boolean; holder?: { owner: string; since: number } };
const acquire = tryAcquire as (file: string, owner: string, o?: { now?: number; ttlMs?: number }) => Result;

const dirs: string[] = [];
function freshLock(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ci-lock-'));
  dirs.push(dir);
  return path.join(dir, 'nested', 'ci-machine.lock');
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('ci-lock: one build at a time on a shared machine', () => {
  it('lets the first pipeline in and makes the second wait, naming who holds it', () => {
    const file = freshLock();
    expect(acquire(file, 'jenkins-27').ok).toBe(true);
    const second = acquire(file, 'ado-1311');
    expect(second.ok).toBe(false);
    expect(second.holder?.owner).toBe('jenkins-27');
  });

  it('frees the machine for the next pipeline once the holder releases it', () => {
    const file = freshLock();
    acquire(file, 'jenkins-27');
    expect(release(file, 'jenkins-27')).toBe(true);
    expect(acquire(file, 'ado-1311').ok).toBe(true);
  });

  it('never lets one pipeline release the other one’s lock', () => {
    const file = freshLock();
    acquire(file, 'jenkins-27');
    expect(release(file, 'ado-1311')).toBe(false);
    expect((readLock(file) as { owner: string }).owner).toBe('jenkins-27');
  });

  it('takes over a lock left by a build that died, once it is older than the limit', () => {
    const file = freshLock();
    acquire(file, 'jenkins-26', { now: 0 });
    expect(acquire(file, 'ado-1311', { now: 10 * 60_000, ttlMs: 150 * 60_000 }).ok).toBe(false);
    expect(acquire(file, 'ado-1311', { now: 151 * 60_000, ttlMs: 150 * 60_000 }).ok).toBe(true);
  });

  it('lets the same owner take it again, so a retried step does not wait for itself', () => {
    const file = freshLock();
    acquire(file, 'ado-1311');
    expect(acquire(file, 'ado-1311').ok).toBe(true);
  });

  it('keeps the lock in ProgramData on Windows, where every service account can write', () => {
    expect(lockFile({ ProgramData: 'C:\\ProgramData' })).toBe(
      path.join('C:\\ProgramData', 'aiqa', 'ci-machine.lock'),
    );
    expect(lockFile({ AIQA_CI_LOCK_DIR: '/x' })).toBe(path.join('/x', 'ci-machine.lock'));
  });

  it('works from the command line: acquire, status, release', () => {
    const file = freshLock();
    const env = { ...process.env, AIQA_CI_LOCK_DIR: path.dirname(file) };
    const run = (...args: string[]) =>
      execFileSync(process.execPath, [path.join('scripts', 'ci-lock.mjs'), ...args], {
        env,
        encoding: 'utf8',
      });
    expect(run('acquire', 'jenkins-27')).toContain('jenkins-27 holds the machine');
    expect(run('status')).toContain('held by jenkins-27');
    expect(run('release', 'jenkins-27')).toContain('released');
    expect(run('status')).toContain('free');
  });
});
