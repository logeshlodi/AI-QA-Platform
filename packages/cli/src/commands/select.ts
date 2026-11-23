import { spawnSync } from 'node:child_process';
import type { Reason, SelectTestsResult } from '@aiqa/ai-agents';

const git = (root: string, args: string[]): string => {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr.trim() || 'failed'}`);
  return r.stdout;
};
const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/**
 * Files changed on this branch since it left `base`, plus uncommitted and new files: what a pull
 * request would contain if opened now. Deleted files are left out (nothing imports them any more).
 */
export function changedFiles(root: string, base: string): { files: string[]; diff: string; base: string } {
  let from = base;
  if (spawnSync('git', ['rev-parse', '--verify', '--quiet', base], { cwd: root }).status !== 0) {
    if (
      base === 'origin/main' &&
      spawnSync('git', ['rev-parse', '--verify', '--quiet', 'main'], { cwd: root }).status === 0
    )
      from = 'main';
    else throw new Error(`No such branch or commit: ${base}. Pass --base, or --files.`);
  }
  const mergeBase = git(root, ['merge-base', from, 'HEAD']).trim();
  const files = new Set([
    ...lines(git(root, ['diff', '--name-only', '--diff-filter=d', mergeBase])),
    ...lines(git(root, ['ls-files', '--others', '--exclude-standard'])),
  ]);
  const diff = git(root, ['diff', '--unified=2', mergeBase, '--', ...files].filter(Boolean));
  return { files: [...files].sort(), diff, base: from };
}

const chain = (via: string[]): string => {
  const middle = via.slice(1, -1);
  return middle.length <= 2
    ? middle.join(' > ')
    : `${middle[0]} > … > ${middle.at(-1)} (${middle.length} files)`;
};
const STRENGTH: Record<Reason['kind'], number> = {
  changed: 6,
  uses: 5,
  covers: 4,
  model: 3,
  shared: 2,
  everything: 1,
};

const describe = (r: Reason): string => {
  switch (r.kind) {
    case 'changed':
      return 'the spec itself changed';
    case 'uses':
      return `uses ${r.file}${r.distance > 1 ? ` (through ${chain(r.via)})` : ''}`;
    case 'covers':
      return `${r.file}: ${r.why}`;
    case 'shared':
      return `reaches ${r.file} only through ${chain(r.via)}, without using it`;
    case 'everything':
      return `${r.file} affects every spec`;
    case 'model':
      return `model: ${r.why}`;
  }
};

const seconds = (ms: number) =>
  ms >= 60_000 ? `${(ms / 60_000).toFixed(1)} min` : `${Math.round(ms / 1000)} s`;

export function formatSelection(result: SelectTestsResult, commands: string[], modelLabel: string): string {
  const out: string[] = [];
  out.push(
    `Changed: ${result.changed.length} file(s). Model: ${modelLabel}${result.model.added ? `, added ${result.model.added}` : ''}.`,
  );
  if (result.everything)
    out.push('A change affects every spec (config, lockfile or workspace): run the full suites.');
  if (result.selected.length === 0 && !result.everything) out.push('\nNo spec is affected by this change.');
  else if (!result.everything) {
    out.push(
      `\nRun ${result.selected.length} spec(s), about ${seconds(result.estimatedMs)}, riskiest first:`,
    );
    for (const s of result.selected) {
      const h = s.history;
      const past = h?.runs
        ? `  [${h.failedRuns}/${h.runs} runs failed${h.flakyRuns ? `, ${h.flakyRuns} flaky` : ''}${h.lastOutcome === 'failed' ? ', failed last time' : ''}]`
        : '';
      out.push(`  ${String(s.score).padStart(3)}  ${s.spec}${past}`);
      const reasons = [...s.reasons].sort((a, b) => STRENGTH[b.kind] - STRENGTH[a.kind]);
      for (const r of reasons.slice(0, 2)) out.push(`         ${describe(r)}`);
      if (s.reasons.length > 2) out.push(`         … and ${s.reasons.length - 2} more reason(s)`);
    }
    out.push('\nCommands:');
    for (const c of commands) out.push(`  ${c}`);
  }
  if (result.reachableOnly.length)
    out.push(
      `\nNot run: ${result.reachableOnly.length} spec(s) load the changed code only through a shared file (fixtures, a package index) and use nothing from it. --wide runs them too.`,
    );
  if (result.overBudget.length)
    out.push(
      `\nLeft out by the time budget (${result.overBudget.length}): ${result.overBudget.map((s) => s.spec).join(', ')}`,
    );
  if (result.unitTested.length)
    out.push(
      `\nCovered by unit tests only: ${result.unitTested.length} file(s). "pnpm test:unit" runs them all on every change.`,
    );
  if (result.uncovered.length)
    out.push(
      `\nNo spec or unit test reaches these changed files (worth a test?):\n  ${result.uncovered.join('\n  ')}`,
    );
  if (result.model.reason && result.model.asked) out.push(`\nModel: ${result.model.reason}`);
  return out.join('\n');
}
