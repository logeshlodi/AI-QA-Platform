import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { HealingReview } from '@aiqa/ai-agents';

/**
 * Decision 5 of the Phase 5 plan: healing fixes leave the agent as local patch files and, on request, a
 * local branch; pushing and opening the pull request stay with a person. No token is involved.
 */
export interface WrittenPatch {
  locatorKey: string;
  patchFile: string;
  descriptionFile: string;
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'heal';

/**
 * One .patch (paths from the repository root, so `git apply --unidiff-zero` takes it) and one .md
 * (the pull-request title and body) per reviewed patch.
 */
export function writeHealPatches(
  reviews: HealingReview[],
  outDir: string,
  packagePath: string,
): WrittenPatch[] {
  const written: WrittenPatch[] = [];
  const prefix = packagePath.replaceAll('\\', '/').replace(/\/$/, '');
  for (const r of reviews) {
    if (!r.patch || !r.diff || r.status === 'refused') continue;
    fs.mkdirSync(outDir, { recursive: true });
    const name = slug(r.locatorKey);
    const patchFile = path.join(outDir, `${name}.patch`);
    const descriptionFile = path.join(outDir, `${name}.md`);
    const diff = r.diff.replace(/^--- a\//m, `--- a/${prefix}/`).replace(/^\+\+\+ b\//m, `+++ b/${prefix}/`);
    fs.writeFileSync(patchFile, diff.endsWith('\n') ? diff : `${diff}\n`);
    fs.writeFileSync(
      descriptionFile,
      `# ${r.title ?? `Update locator ${r.locatorKey}`}\n\n${r.body ?? ''}\n`,
    );
    written.push({ locatorKey: r.locatorKey, patchFile, descriptionFile });
  }
  return written;
}

const git = (cwd: string, args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** Tracked files with changes. Untracked files do not block a branch: they are not committed. */
export function changedTrackedFiles(repoRoot: string): string[] {
  // Not trimmed: each porcelain line starts with a two-letter status that may begin with a space.
  return execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
    .map((l) => l.slice(3));
}

/**
 * Commits the applied patches on a new `heal/<stamp>` branch. Only the patched page objects are added,
 * so nothing else in the working tree is swept in. Returns the branch name.
 */
export function commitHealBranch(
  repoRoot: string,
  applied: HealingReview[],
  packagePath: string,
  now = new Date(),
): string {
  if (applied.length === 0) throw new Error('No patch was applied, so there is nothing to commit.');
  const stamp = now.toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const branch = `heal/${stamp}`;
  git(repoRoot, ['switch', '-c', branch]);
  const files = [...new Set(applied.map((r) => `${packagePath.replaceAll('\\', '/')}/${r.patch!.file}`))];
  git(repoRoot, ['add', '--', ...files]);
  const subject =
    applied.length === 1
      ? `fix(heal): ${(applied[0]!.title ?? `update locator ${applied[0]!.locatorKey}`).replace(/^[A-Z]/, (c) => c.toLowerCase())}`
      : `fix(heal): update ${applied.length} locators found by the healer`;
  const body = applied.map((r) => `${r.title ?? r.locatorKey}\n\n${r.body ?? ''}`).join('\n\n---\n\n');
  git(repoRoot, ['commit', '-m', subject, '-m', body]);
  return branch;
}
