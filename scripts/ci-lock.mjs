#!/usr/bin/env node
// One build at a time on a machine that runs more than one CI system (Jenkins and an Azure DevOps
// agent on the same laptop). Both build every push, both run the browser suites, and both start and
// stop the same Docker stack: run together, the first to finish takes the stack away from the other,
// and the load alone makes Firefox time out. Each pipeline takes this lock first and gives it back
// at the end, so the second one waits instead.
//
//   node scripts/ci-lock.mjs acquire <owner>   waits until the machine is free, then holds it
//   node scripts/ci-lock.mjs release <owner>   gives it back (only the owner can)
//   node scripts/ci-lock.mjs status            who holds it, if anyone
//
// The lock is a file created with O_EXCL, so taking it is atomic. It lives in ProgramData on Windows
// (every account can write there, and Jenkins and the agent run as different accounts), otherwise in
// the temp folder. A lock older than AIQA_CI_LOCK_TTL_MIN (default 150) is a build that died without
// releasing it, and is taken over.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function lockFile(env = process.env) {
  const dir = env.AIQA_CI_LOCK_DIR ?? path.join(env.ProgramData ?? tmpdir(), 'aiqa');
  return path.join(dir, 'ci-machine.lock');
}

export function readLock(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

/** One attempt. Returns `{ ok: true }`, or `{ ok: false, holder }` while someone else holds it. */
export function tryAcquire(file, owner, { now = Date.now(), ttlMs = 150 * 60_000 } = {}) {
  mkdirSync(path.dirname(file), { recursive: true });
  try {
    writeFileSync(file, JSON.stringify({ owner, since: now }), { flag: 'wx' });
    return { ok: true };
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const holder = readLock(file);
  // Ours already (a retried step), unreadable (a write cut short), or left by a build that died.
  if (!holder || holder.owner === owner || now - holder.since > ttlMs) {
    rmSync(file, { force: true });
    return tryAcquire(file, owner, { now, ttlMs });
  }
  return { ok: false, holder };
}

export function release(file, owner) {
  const holder = readLock(file);
  if (holder && holder.owner !== owner) return false;
  rmSync(file, { force: true });
  return true;
}

async function acquire(file, owner, env) {
  const ttlMs = Number(env.AIQA_CI_LOCK_TTL_MIN ?? 150) * 60_000;
  const maxWaitMs = Number(env.AIQA_CI_LOCK_WAIT_MIN ?? 90) * 60_000;
  const pollMs = Number(env.AIQA_CI_LOCK_POLL_S ?? 15) * 1000;
  const started = Date.now();
  let told = '';
  for (;;) {
    const result = tryAcquire(file, owner, { ttlMs });
    if (result.ok) {
      const waited = Math.round((Date.now() - started) / 1000);
      console.log(`[ci-lock] ${owner} holds the machine${waited ? ` (waited ${waited}s)` : ''}.`);
      return;
    }
    if (result.holder.owner !== told) {
      const mins = Math.round((Date.now() - result.holder.since) / 60_000);
      console.log(`[ci-lock] waiting: ${result.holder.owner} has held the machine for ${mins} min.`);
      told = result.holder.owner;
    }
    if (Date.now() - started > maxWaitMs) {
      throw new Error(
        `[ci-lock] gave up after ${maxWaitMs / 60_000} min; ${result.holder.owner} still holds ${file}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

async function main([command, owner], env = process.env) {
  const file = lockFile(env);
  if (command === 'status') {
    const holder = readLock(file);
    console.log(
      holder
        ? `[ci-lock] held by ${holder.owner} since ${new Date(holder.since).toISOString()}`
        : '[ci-lock] free',
    );
    return;
  }
  if (!owner || !['acquire', 'release'].includes(command)) {
    throw new Error('usage: node scripts/ci-lock.mjs acquire|release <owner> | status');
  }
  if (command === 'acquire') return acquire(file, owner, env);
  console.log(
    release(file, owner)
      ? `[ci-lock] ${owner} released the machine.`
      : `[ci-lock] ${owner} does not hold it; left alone.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
