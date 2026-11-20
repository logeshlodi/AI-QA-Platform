import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRunLog } from '@aiqa/ai-agents';
import type { ResultRecord, StoredRun } from '@aiqa/reporting-engine';
import type { HealEvent } from '@aiqa/self-healing-engine';
import { createPlatformServer, type PlatformData } from '../src';

const result = (
  runId: string,
  testId: string,
  status: ResultRecord['status'],
  retry = 0,
  errorMessage?: string,
): ResultRecord => ({
  runId,
  testId,
  retry,
  title: `test ${testId}`,
  file: 'journeys/a.spec.ts',
  project: 'chromium',
  status,
  durationMs: 100,
  errorMessage,
  metrics: testId === 'a' ? { lcp_ms: runId === 'r4' ? 900 : 400 } : undefined,
});
const run = (id: string, day: number, suite: string, results: ResultRecord[]): StoredRun => ({
  run: {
    id,
    suite,
    startedAt: `2026-11-0${day}T10:00:00Z`,
    finishedAt: `2026-11-0${day}T10:05:00Z`,
    environment: 'local',
  },
  results,
});

const RUNS: StoredRun[] = [
  run('r1', 1, 'ui', [result('r1', 'a', 'passed'), result('r1', 'b', 'passed')]),
  run('r2', 2, 'ui', [result('r2', 'a', 'passed'), result('r2', 'b', 'failed', 0, 'boom')]),
  run('r3', 3, 'ui', [result('r3', 'a', 'passed'), result('r3', 'b', 'passed')]),
  run('r4', 4, 'ui', [
    result('r4', 'a', 'failed', 0, 'page.goto: net::ERR_CONNECTION_REFUSED at https://www.saucedemo.com/'),
    result('r4', 'b', 'failed', 0, 'Timed out'),
    result('r4', 'b', 'passed', 1),
  ]),
  run('a1', 5, 'api', [result('a1', 'x', 'passed')]),
];

const HEALS: HealEvent[] = [
  {
    locatorKey: 'login.button',
    testId: 'a',
    failedSelector: '#login',
    healedSelector: "getByRole('button')",
    strategy: 'role',
    score: 0.91,
    outcome: 'healed',
    createdAt: '2026-11-03T10:00:00Z',
  },
  {
    locatorKey: 'cart.badge',
    testId: 'b',
    failedSelector: '.badge',
    strategy: 'text',
    score: 0.4,
    outcome: 'refused',
    createdAt: '2026-11-04T10:00:00Z',
  },
];

const clients: Client[] = [];
afterEach(async () => {
  for (const c of clients.splice(0)) await c.close();
});

async function connect(data: Partial<PlatformData> = {}) {
  const server = createPlatformServer({ runs: () => RUNS, heals: () => HEALS, ...data });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '1.0.0' });
  await server.connect(serverSide);
  await client.connect(clientSide);
  clients.push(client);
  return client;
}

const call = async (client: Client, name: string, args: Record<string, unknown> = {}) => {
  const res = await client.callTool({ name, arguments: args });
  expect(res.isError, JSON.stringify(res.content)).toBeFalsy();
  // Text and structured content carry the same data.
  expect(JSON.parse((res.content as { text: string }[])[0]!.text)).toEqual(res.structuredContent);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON read back in a test
  return res.structuredContent as Record<string, any>;
};

describe('aiqa MCP server', () => {
  it('lists its seven tools, each with an input schema', async () => {
    const { tools } = await (await connect()).listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'flaky_tests',
      'heal_events',
      'list_runs',
      'make_test_data',
      'perf_trends',
      'run_failures',
      'triage_failures',
    ]);
    for (const t of tools) expect(t.inputSchema.type).toBe('object');
  });

  it('list_runs: newest first, filtered by suite', async () => {
    const client = await connect();
    const { runs } = await call(client, 'list_runs', { suite: 'ui', limit: 2 });
    expect(runs.map((r: { runId: string }) => r.runId)).toEqual(['r4', 'r3']);
    expect(runs[0]).toMatchObject({ failed: 1, flaky: 1 });
  });

  it('run_failures: the latest run of a suite by default, failed and flaky tests with their first error line', async () => {
    const { failures, run: summary } = await call(await connect(), 'run_failures', { suite: 'ui' });
    expect(summary.runId).toBe('r4');
    expect(failures).toEqual([
      expect.objectContaining({
        testId: 'a',
        outcome: 'failed',
        error: 'page.goto: net::ERR_CONNECTION_REFUSED at https://www.saucedemo.com/',
      }),
      expect.objectContaining({ testId: 'b', outcome: 'flaky' }),
    ]);
  });

  it('flaky_tests and perf_trends read the same history', async () => {
    const client = await connect();
    const { flaky } = await call(client, 'flaky_tests');
    expect(flaky.map((f: { testId: string }) => f.testId)).toContain('b');
    const { trends } = await call(client, 'perf_trends');
    expect(trends).toEqual([
      expect.objectContaining({ metric: 'lcp_ms', verdict: 'regressed', latest: 900 }),
    ]);
  });

  it('heal_events: newest first, filtered by outcome', async () => {
    const client = await connect();
    expect((await call(client, 'heal_events')).events.map((e: HealEvent) => e.locatorKey)).toEqual([
      'cart.badge',
      'login.button',
    ]);
    expect((await call(client, 'heal_events', { outcome: 'healed' })).events).toHaveLength(1);
  });

  it('make_test_data: the same seed gives the same records', async () => {
    const client = await connect();
    const one = await call(client, 'make_test_data', { entity: 'customer', count: 2, seed: 7 });
    const two = await call(client, 'make_test_data', { entity: 'customer', count: 2, seed: 7 });
    expect(one.records).toHaveLength(2);
    expect(one.records).toEqual(two.records);
  });

  it('triage_failures: rules answer without a model, and every verdict is logged', async () => {
    const log = new MemoryRunLog();
    const { model, results } = await call(await connect({ log }), 'triage_failures', { suite: 'ui' });
    expect(model).toBe('off');
    expect(results).toEqual([
      expect.objectContaining({ testId: 'a', label: 'environment', source: 'rules' }),
      expect.objectContaining({ testId: 'b', label: 'flaky', source: 'rules' }),
    ]);
    expect(log.records).toHaveLength(2);
  });

  it('refuses bad arguments with a readable error instead of crashing', async () => {
    const res = await (
      await connect()
    ).callTool({ name: 'make_test_data', arguments: { entity: 'invoice' } });
    expect(res.isError).toBe(true);
    expect(JSON.stringify(res.content)).toMatch(/entity/);
  });
});
