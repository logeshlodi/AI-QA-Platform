import {
  buildTriageContexts,
  triage,
  type DecisionStore,
  type ModelChoice,
  type RunLog,
} from '@aiqa/ai-agents';
import { detectFlaky, metricTrends, outcomesOf, summarize, type StoredRun } from '@aiqa/reporting-engine';
import type { HealEvent } from '@aiqa/self-healing-engine';
import { aCustomer, anOrder, aProduct, shop } from '@aiqa/test-data-engine';
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

/** Where the server reads from. Injected, so tests run on fixed data and the real server on the laptop's files. */
export interface PlatformData {
  runs(): StoredRun[];
  heals(): HealEvent[];
  model?: ModelChoice;
  log?: RunLog;
  /** People's triage decisions; an exact match answers from them. */
  decisions?: DecisionStore;
}

const firstLine = (s?: string) =>
  (s ?? '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split('\n')[0]
    ?.trim() ?? '';

/** structuredContent for clients that read it, the same JSON as text for clients that do not. */
const reply = <T extends Record<string, unknown>>(data: T) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  structuredContent: data,
});

const latestOf = (runs: StoredRun[], suite?: string) =>
  [...runs]
    .filter((r) => !suite || r.run.suite === suite)
    .sort((a, b) => a.run.startedAt.localeCompare(b.run.startedAt))
    .at(-1);

/**
 * The platform as MCP tools. Every tool is read-only: it reads run history, the heal audit or
 * seeded builders, and `triage_failures` runs the Triage agent, which only reads.
 * Results are data from test runs; MCP clients should treat their text as data, not instructions.
 */
export function createPlatformServer(data: PlatformData): McpServer {
  const server = new McpServer({ name: 'aiqa', version: '0.1.0' });

  server.registerTool(
    'list_runs',
    {
      description: 'Recorded test runs, newest first, with pass rate and failure counts.',
      inputSchema: z.object({
        suite: z.string().optional().describe('Only this suite, e.g. "ui", "api", "data".'),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    },
    async ({ suite, limit }) => {
      const runs = data
        .runs()
        .filter((r) => !suite || r.run.suite === suite)
        .sort((a, b) => b.run.startedAt.localeCompare(a.run.startedAt))
        .slice(0, limit)
        .map(summarize);
      return reply({ runs });
    },
  );

  server.registerTool(
    'run_failures',
    {
      description:
        'The failed and flaky tests of one run (the latest when no run id is given), with the first line of each error.',
      inputSchema: z.object({
        runId: z.string().optional(),
        suite: z.string().optional().describe('With no run id: the latest run of this suite.'),
      }),
    },
    async ({ runId, suite }) => {
      const stored = runId ? data.runs().find((r) => r.run.id === runId) : latestOf(data.runs(), suite);
      if (!stored) return reply({ found: false, failures: [] });
      const failures = outcomesOf(stored.results)
        .filter((o) => o.outcome === 'failed' || o.outcome === 'flaky')
        .map((o) => ({
          testId: o.testId,
          title: o.title,
          file: o.file,
          project: o.project,
          outcome: o.outcome,
          error: firstLine(o.errorMessage),
        }));
      return reply({ found: true, run: summarize(stored), failures });
    },
  );

  server.registerTool(
    'flaky_tests',
    {
      description:
        'Tests whose result cannot be trusted: passed only on retry, or flipped green/red across runs.',
      inputSchema: z.object({ window: z.number().int().min(3).max(100).default(20) }),
    },
    async ({ window }) => reply({ flaky: detectFlaky(data.runs(), { window }) }),
  );

  server.registerTool(
    'perf_trends',
    {
      description:
        'Performance metrics against their usual level. Regressions first; steady ones only with all=true.',
      inputSchema: z.object({ all: z.boolean().default(false) }),
    },
    async ({ all }) => {
      const order = { regressed: 0, improved: 1, new: 2, steady: 3 } as const;
      const trends = metricTrends(data.runs())
        .filter((t) => all || t.verdict === 'regressed' || t.verdict === 'improved')
        .sort((a, b) => order[a.verdict] - order[b.verdict])
        .map((t) => {
          const { values, ...rest } = t; // the sparkline values are for the dashboard, not for a model
          void values;
          return rest;
        });
      return reply({ trends });
    },
  );

  server.registerTool(
    'heal_events',
    {
      description: 'The self-healing audit trail: every healed or refused locator, newest first.',
      inputSchema: z.object({
        outcome: z.enum(['healed', 'refused']).optional(),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    },
    async ({ outcome, limit }) => {
      const events = data
        .heals()
        .filter((e) => !outcome || e.outcome === outcome)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
      return reply({ events });
    },
  );

  server.registerTool(
    'make_test_data',
    {
      description: 'Seeded test data as JSON. The same seed always gives the same records.',
      inputSchema: z.object({
        entity: z.enum(['customer', 'product', 'order', 'shop']),
        count: z.number().int().min(1).max(50).default(1),
        seed: z.number().int().min(1).default(1),
      }),
    },
    async ({ entity, count, seed }) => {
      const records =
        entity === 'customer'
          ? aCustomer(seed).buildMany(count)
          : entity === 'product'
            ? aProduct(seed).buildMany(count)
            : entity === 'order'
              ? anOrder(seed).buildMany(count)
              : shop({ seed, customers: count });
      return reply({ entity, seed, records });
    },
  );

  server.registerTool(
    'triage_failures',
    {
      description:
        "Why each failed test of a run failed: product bug, test bug, flaky or environment, with evidence and a next step. Uses rules, and the platform's model when one is configured.",
      inputSchema: z.object({
        runId: z.string().optional(),
        suite: z.string().optional().describe('With no run id: the latest run of this suite.'),
        limit: z.number().int().min(1).max(20).default(5),
      }),
    },
    async ({ runId, suite, limit }) => {
      const runs = data.runs();
      const id = runId ?? latestOf(runs, suite)?.run.id;
      const contexts = id ? buildTriageContexts(runs, id).slice(0, limit) : [];
      const results = [];
      for (const ctx of contexts) {
        const verdict = await triage(ctx, { model: data.model, log: data.log, memory: data.decisions });
        results.push({
          testId: ctx.testId,
          title: ctx.title,
          error: firstLine(ctx.errorMessage),
          ...verdict,
        });
      }
      return reply({ model: data.model?.label ?? 'off', results });
    },
  );

  return server;
}
