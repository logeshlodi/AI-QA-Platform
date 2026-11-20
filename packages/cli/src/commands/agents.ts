import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import type { AgentRunRecord, HealingReview, SpecCheck, TriageContext, TriageVerdict } from '@aiqa/ai-agents';

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** One block per failed test: label, why, the evidence and what to do next. */
export function formatTriage(items: { ctx: TriageContext; verdict: TriageVerdict }[], model: string): string {
  if (items.length === 0) return 'Nothing to triage: the run has no failed or flaky tests.';
  const blocks = items.map(({ ctx, verdict }) =>
    [
      `${verdict.label.toUpperCase().padEnd(12)} ${ctx.title}  (${verdict.source}, ${verdict.confidence} confidence)`,
      `  why:   ${verdict.reason}`,
      ...verdict.evidence.map((e) => `  seen:  ${clip(e, 140)}`),
      `  next:  ${verdict.nextStep}`,
    ].join('\n'),
  );
  return [`Model: ${model}`, '', ...blocks].join('\n\n');
}

/** The agent run log, newest first. */
export function formatAgentLog(records: AgentRunRecord[]): string {
  if (records.length === 0) return 'No agent runs logged yet. Try "pnpm aiqa agents triage".';
  const pad = (v: string | number, w: number) => String(v).padEnd(w);
  const head = `${pad('Started (UTC)', 18)}${pad('Agent', 9)}${pad('Source', 8)}${pad('Tools', 7)}${pad('Time', 9)}${pad('Model', 26)}Result`;
  const rows = records.map((r) => {
    const out = r.output as { label?: string } | undefined;
    return `${pad(r.startedAt.replace('T', ' ').slice(0, 16), 18)}${pad(r.agent, 9)}${pad(r.source, 8)}${pad(r.toolCalls.length, 7)}${pad(`${(r.durationMs / 1000).toFixed(1)}s`, 9)}${pad(clip(r.model, 25), 26)}${out?.label ?? ''}${r.fallbackReason && r.source === 'rules' && out?.label === 'unknown' ? ` (${clip(r.fallbackReason, 50)})` : ''}`;
  });
  return [head, ...rows].join('\n');
}

/** "Add the backpack to the cart" -> "add-the-backpack-to-the-cart" (at most 60 characters). */
export const slug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '');

const tail = (text: string, lines: number) => text.split('\n').slice(-lines).join('\n');

/**
 * The generator's check: write the spec, lint it, then run it `runs` times in Chromium with no
 * retries. Lint and test output on failure go back to the model as its errors.
 */
export function specCheck(framework: string, file: string, runs: number): SpecCheck {
  const repoRoot = path.resolve(framework, '..', '..');
  const eslint = path.join(repoRoot, 'node_modules', 'eslint', 'bin', 'eslint.js');
  const playwright = require.resolve('@playwright/test/cli', { paths: [framework] });
  return async (code, attempt) => {
    const target = path.join(framework, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, code);
    console.log(`  attempt ${attempt}: wrote ${file}; linting and running it ${runs} times…`);
    const lint = spawnSync(process.execPath, [eslint, '--no-warn-ignored', target], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    if (lint.status !== 0) {
      // Show the model the lines ESLint points at, not only their numbers.
      const source = code.split('\n');
      const cited = [...(lint.stdout + lint.stderr).matchAll(/^\s+(\d+):\d+\s+error/gm)]
        .map((m) => Number(m[1]))
        .map((n) => `line ${n}: ${source[n - 1]?.trim() ?? ''}`);
      return { ok: false, errors: `ESLint:\n${tail(lint.stdout + lint.stderr, 40)}\n${cited.join('\n')}` };
    }
    const run = spawnSync(
      process.execPath,
      [
        playwright,
        'test',
        file,
        '--project=chromium',
        `--repeat-each=${runs}`,
        '--retries=0',
        '--reporter=line',
      ],
      { cwd: framework, encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0' }, timeout: 600_000 },
    );
    if (run.status !== 0) return { ok: false, errors: `Playwright:\n${tail(run.stdout + run.stderr, 60)}` };
    return { ok: true };
  };
}

/** Asks on the terminal; with no terminal (CI, a pipe) the answer is always no. */
export async function askOnTerminal(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(es)?$/i.test((await rl.question(`${question} [y/N] `)).trim());
  } finally {
    rl.close();
  }
}

export function formatHealingReviews(reviews: HealingReview[]): string {
  if (reviews.length === 0) return 'No heal events recorded yet. Healing runs in the UI suite record them.';
  return reviews
    .map((r) =>
      r.status === 'refused'
        ? `REFUSED  ${r.locatorKey}\n  ${r.reason}`
        : [
            `${r.status.toUpperCase().padEnd(8)} ${r.locatorKey}  (${r.source})`,
            '',
            `  ${r.title}`,
            '',
            ...(r.body ?? '').split('\n').map((l) => `  ${l}`),
            '',
            r.diff,
          ].join('\n'),
    )
    .join('\n\n');
}
