import { describe, expect, it } from 'vitest';
import { formatMetric, metricTrends, renderDashboard, type StoredRun } from '../src';
import { metricsOf } from '../src/playwright-reporter';
import { run } from './helpers';

/** A run of one test `t` whose final attempt recorded `metrics`. */
function measured(
  metrics: Record<string, number>,
  attempts: ('passed' | 'failed' | 'skipped')[] = ['passed'],
): StoredRun {
  const stored = run({ t: attempts }, 'perf');
  const last = stored.results[stored.results.length - 1]!;
  last.metrics = metrics;
  return stored;
}
const series = (values: number[]) => values.map((lcp_ms) => measured({ lcp_ms }));

describe('metricsOf', () => {
  it('reads name=value metric annotations and ignores everything else', () => {
    expect(
      metricsOf([
        { type: 'metric', description: 'lcp_ms=412.5' },
        { type: 'metric', description: 'cls=0.02' },
        { type: 'issue', description: 'JIRA-1=2' },
        { type: 'metric', description: 'broken' },
        { type: 'metric', description: 'nan=abc' },
      ]),
    ).toEqual({ lcp_ms: 412.5, cls: 0.02 });
  });

  it('returns undefined when a test recorded no metrics, so nothing is stored', () => {
    expect(metricsOf([{ type: 'tag', description: '@perf' }])).toBeUndefined();
  });

  it('keeps the last value when a name is recorded twice', () => {
    expect(
      metricsOf([
        { type: 'metric', description: 'a=1' },
        { type: 'metric', description: 'a=2' },
      ]),
    ).toEqual({ a: 2 });
  });
});

describe('metricTrends', () => {
  it('a first measurement is "new", with no baseline', () => {
    const [trend] = metricTrends(series([400]));
    expect(trend).toMatchObject({ metric: 'lcp_ms', latest: 400, verdict: 'new' });
    expect(trend?.baseline).toBeUndefined();
  });

  it('compares the latest value with the median of the earlier runs', () => {
    const [trend] = metricTrends(series([400, 420, 410, 600]));
    expect(trend).toMatchObject({ latest: 600, baseline: 410, verdict: 'regressed' });
    expect(trend?.change).toBeCloseTo(0.463, 3);
  });

  it('one slow run in the baseline does not move it (median, not mean)', () => {
    const [trend] = metricTrends(series([400, 410, 5000, 405, 420]));
    expect(trend).toMatchObject({ baseline: 407.5, verdict: 'steady' });
  });

  it('reports improvements, and treats changes inside the tolerance as steady', () => {
    expect(metricTrends(series([400, 400, 400, 250]))[0]?.verdict).toBe('improved');
    expect(metricTrends(series([400, 400, 400, 470]))[0]?.verdict).toBe('steady');
    expect(metricTrends(series([400, 400, 400, 470]), { tolerance: 0.1 })[0]?.verdict).toBe('regressed');
  });

  it('gives no verdict until there are enough earlier runs, but shows the baseline so far', () => {
    const [trend] = metricTrends(series([400, 400, 900]));
    expect(trend).toMatchObject({ baseline: 400, verdict: 'new' });
    expect(metricTrends(series([400, 400, 900]), { minBaselineRuns: 2 })[0]?.verdict).toBe('regressed');
  });

  it('ignores changes below an absolute floor however large in percent', () => {
    const trend = metricTrends(series([5, 5, 5, 9]), { minAbsoluteChange: 10 })[0];
    expect(trend?.verdict).toBe('steady');
  });

  it('only the last baselineRuns runs form the baseline', () => {
    const [trend] = metricTrends(series([900, 900, 900, 400, 400, 400]), { baselineRuns: 2 });
    expect(trend).toMatchObject({ baseline: 400, verdict: 'steady' });
  });

  it("uses each test's final attempt and skips runs where the test was skipped", () => {
    const first = measured({ lcp_ms: 400 }); // runs are timestamped in the order they are built
    const retried = run({ t: ['failed', 'passed'] }, 'perf');
    retried.results[0]!.metrics = { lcp_ms: 9999 };
    retried.results[1]!.metrics = { lcp_ms: 410 };
    const skipped = measured({ lcp_ms: 1 }, ['skipped']);
    const [trend] = metricTrends([first, retried, skipped]);
    expect(trend?.values).toEqual([400, 410]);
  });

  it('lists regressions first', () => {
    const runs = [measured({ a_ms: 100, b_ms: 100 }), measured({ a_ms: 100, b_ms: 300 })];
    expect(metricTrends(runs, { minBaselineRuns: 1 }).map((t) => [t.metric, t.verdict])).toEqual([
      ['b_ms', 'regressed'],
      ['a_ms', 'steady'],
    ]);
  });
});

describe('formatMetric', () => {
  it('formats by the unit in the name', () => {
    expect(formatMetric('lcp_ms', 412.4)).toBe('412 ms');
    expect(formatMetric('lcp_ms', 12_345)).toBe('12.3 s');
    expect(formatMetric('transfer_bytes', 337_291)).toBe('329.4 KB');
    expect(formatMetric('decoded_bytes', 3 * 1024 * 1024)).toBe('3.00 MB');
    expect(formatMetric('cls', 0.0234)).toBe('0.023');
    expect(formatMetric('requests', 10)).toBe('10');
  });
});

describe('dashboard performance section', () => {
  it('appears only when metrics were recorded, with the verdict in words', () => {
    expect(renderDashboard([run({ a: ['passed'] })])).not.toContain('Performance trends');
    const html = renderDashboard(series([400, 410, 405, 700]));
    expect(html).toContain('Performance trends');
    expect(html).toContain('Regressed');
    expect(html).toContain('700 ms');
  });
});
