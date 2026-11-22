import fs from 'node:fs';
import type { AgentRunRow, FlakyRow, HealRow, RunRow, TestRow, TrendPoint } from '@aiqa/dashboard';
import { detectFlaky, openRunHistory, outcomesOf, summarize, type StoredRun } from '@aiqa/reporting-engine';
// The store alone: the package index also loads the healing strategies and the AI engine.
import { createHealRepository } from '@aiqa/self-healing-engine/src/store/factory';
import type { HealEvent } from '@aiqa/self-healing-engine';
import { config } from './config';

/**
 * Read-only views of the platform's own data, mapped to the dashboard components' view models.
 * Nothing here writes: no history, heal store or log is created when it is missing.
 */

/** Recorded runs, newest first. */
export function loadRuns(limit = 200): StoredRun[] {
  const repo = openRunHistory(config.data.historyDir);
  try {
    return repo.listRuns(limit).reverse();
  } finally {
    repo.close();
  }
}

export function toRunRow(stored: StoredRun): RunRow {
  const s = summarize(stored);
  return {
    id: s.runId,
    suite: s.suite,
    startedAt: s.startedAt,
    environment: stored.run.environment,
    passed: s.passed,
    failed: s.failed,
    flaky: s.flaky,
    skipped: s.skipped,
    durationMs: s.durationMs,
  };
}

export function toTestRows(stored: StoredRun): TestRow[] {
  return outcomesOf(stored.results).map((o) => ({
    id: `${o.testId}:${o.project}`,
    title: o.title,
    file: o.file,
    project: o.project,
    status: o.outcome,
    durationMs: o.durationMs,
    retries: o.attempts - 1,
    error: o.errorMessage,
  }));
}

export const suitesOf = (runs: StoredRun[]) => [...new Set(runs.map((r) => r.run.suite))].sort();

/** "22 Nov 09:30": short enough for a chart axis, in UTC like every time on the dashboard. */
function shortLabel(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCDate()} ${month} ${hh}:${mm}`;
}

/** Pass rate and duration of one suite's runs, oldest first. */
export function suiteTrends(
  runs: StoredRun[],
  suite: string,
  last = 20,
): { passRate: TrendPoint[]; duration: TrendPoint[] } {
  const ofSuite = runs
    .filter((r) => r.run.suite === suite)
    .slice(0, last)
    .reverse()
    .map(summarize);
  return {
    passRate: ofSuite.map((s) => ({ label: shortLabel(s.startedAt), value: s.passRate })),
    duration: ofSuite.map((s) => ({
      label: shortLabel(s.startedAt),
      value: Math.round(s.durationMs / 100) / 10,
    })),
  };
}

export function flakyRows(runs: StoredRun[]): FlakyRow[] {
  return detectFlaky(runs).map((f) => {
    const lastRun = runs.find((r) => r.results.some((x) => x.testId === f.testId));
    return {
      testId: `${f.testId}:${f.project}`,
      title: f.title,
      file: f.file,
      flakyRuns: Math.min(f.runs, f.flips + f.retriedPasses),
      runs: f.runs,
      lastSeen: lastRun?.run.startedAt ?? '',
    };
  });
}

export function loadHeals(): HealRow[] {
  if (!fs.existsSync(config.data.healDir)) return [];
  const repo = createHealRepository(config.data.healDir);
  try {
    return repo
      .listEvents()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toHealRow);
  } finally {
    repo.close();
  }
}

export function toHealRow(e: HealEvent, i = 0): HealRow {
  return {
    id: `${e.createdAt}:${e.locatorKey}:${i}`,
    locatorKey: e.locatorKey,
    original: e.failedSelector,
    healed: e.outcome === 'healed' ? (e.suggestion ?? e.healedSelector ?? '') : (e.suggestion ?? ''),
    score: e.score,
    outcome: e.outcome === 'healed' ? 'healed' : e.suggestion ? 'suggested' : 'rejected',
    at: e.createdAt,
    suggestion: `${e.strategy} strategy`,
  };
}

interface LoggedAgentRun {
  id: string;
  agent: string;
  startedAt: string;
  durationMs: number;
  model: string;
  source: 'model' | 'rules';
  fallbackReason?: string;
  toolCalls?: unknown[];
}

/** The agent run log (JSON lines), newest first. A torn last line is skipped. */
export function loadAgentRuns(limit = 100): AgentRunRow[] {
  if (!fs.existsSync(config.data.agentLog)) return [];
  const rows: AgentRunRow[] = [];
  for (const line of fs.readFileSync(config.data.agentLog, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line) as LoggedAgentRun;
      rows.push({
        id: r.id,
        agent: r.agent,
        model: r.model,
        source: r.source,
        startedAt: r.startedAt,
        durationMs: r.durationMs,
        toolCalls: r.toolCalls?.length ?? 0,
        fallbackReason: r.fallbackReason,
      });
    } catch {
      // a run killed mid-write
    }
  }
  return rows.reverse().slice(0, limit);
}
