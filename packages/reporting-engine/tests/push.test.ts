import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { pushRunMetrics, runMetrics } from '../src';
import { run } from './helpers';

const sample = (text: string, name: string) =>
  text
    .split('\n')
    .filter((line) => line.startsWith(name) && !line.startsWith('#'))
    .map((line) => line.trim());

describe('runMetrics', () => {
  it('counts outcomes and the pass rate of the latest run', () => {
    const text = runMetrics(
      run({ a: ['passed'], b: ['failed', 'passed'], c: ['failed', 'failed'], d: ['skipped'] }),
    );
    expect(sample(text, 'aiqa_run_tests{')).toEqual([
      'aiqa_run_tests{status="passed"} 1',
      'aiqa_run_tests{status="failed"} 1',
      'aiqa_run_tests{status="flaky"} 1',
      'aiqa_run_tests{status="skipped"} 1',
    ]);
    // passed + flaky over executed: 2 of 3
    expect(sample(text, 'aiqa_run_pass_rate')).toEqual(['aiqa_run_pass_rate 66.7']);
    expect(text).toContain('# TYPE aiqa_run_pass_rate gauge');
  });

  it('includes recorded performance metrics, with label values escaped', () => {
    const stored = run({ t: ['passed'] }, 'perf');
    stored.results[0]!.title = 'login "fast"\\path';
    stored.results[0]!.metrics = { lcp_ms: 412 };
    expect(sample(runMetrics(stored), 'aiqa_test_metric')).toEqual([
      'aiqa_test_metric{test="login \\"fast\\"\\\\path",project="chromium",metric="lcp_ms"} 412',
    ]);
  });

  it('counts flaky tests across the suite history, not only in the latest run', () => {
    // Green, red, green across three runs: two flips, so flaky by detectFlaky's rule.
    const history = [run({ a: ['passed'] }), run({ a: ['failed'] }), run({ a: ['passed'] })];
    expect(sample(runMetrics(history[2]!, history), 'aiqa_flaky_tests')).toEqual(['aiqa_flaky_tests 1']);
    expect(sample(runMetrics(history[2]!, [history[2]!]), 'aiqa_flaky_tests')).toEqual([
      'aiqa_flaky_tests 0',
    ]);
  });

  it('leaves out families with nothing to report', () => {
    expect(runMetrics(run({ a: ['passed'] }))).not.toContain('aiqa_test_metric');
  });
});

describe('pushRunMetrics', () => {
  let server: http.Server | undefined;
  afterEach(() => server?.close());

  it('PUTs the metrics to the suite group of the Pushgateway', async () => {
    const received: { method?: string; url?: string; body: string }[] = [];
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        received.push({ method: req.method, url: req.url, body });
        res.writeHead(200).end();
      });
    });
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    const stored = run({ a: ['passed'] }, 'ui');
    expect(await pushRunMetrics(`http://127.0.0.1:${port}/`, stored)).toBe(true);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ method: 'PUT', url: '/metrics/job/aiqa_tests/suite/ui' });
    expect(received[0]!.body).toContain('aiqa_run_pass_rate 100');
  });

  it('reports failure without throwing when the gateway is unreachable', async () => {
    expect(await pushRunMetrics('http://127.0.0.1:9', run({ a: ['passed'] }))).toBe(false);
  });
});
