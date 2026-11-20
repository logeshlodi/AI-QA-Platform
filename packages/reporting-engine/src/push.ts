import { detectFlaky, metricTrends, outcomesOf, slowest, summarize } from './analysis';
import type { StoredRun } from './types';

/**
 * Test monitoring: a finished run as Prometheus metrics, pushed to a Prometheus Pushgateway so
 * Grafana can chart pass rates, durations, flaky tests and performance numbers next to the
 * service's own metrics.
 *
 * Why a Pushgateway: a test run is a batch job that ends, so nothing would be there for Prometheus
 * to scrape. The run pushes its numbers instead, and the gateway keeps the latest set per suite
 * until the next run replaces it. Prometheus scrapes the gateway, which turns the series of runs
 * into a timeline.
 */

/** Escapes a label value for the Prometheus text format. */
const label = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
const labels = (pairs: Record<string, string>) =>
  `{${Object.entries(pairs)
    .map(([k, v]) => `${k}="${label(v)}"`)
    .join(',')}}`;

interface Family {
  name: string;
  help: string;
  samples: { labels?: Record<string, string>; value: number }[];
}

function render(families: Family[]): string {
  return (
    families
      .filter((f) => f.samples.length > 0)
      .map((f) =>
        [
          `# HELP ${f.name} ${f.help}`,
          `# TYPE ${f.name} gauge`,
          ...f.samples.map((s) => `${f.name}${s.labels ? labels(s.labels) : ''} ${s.value}`),
        ].join('\n'),
      )
      .join('\n') + '\n'
  );
}

/**
 * The metrics for one finished run of a suite. `history` is that suite's recent runs, the new one
 * included: flaky-test and regression counts look across runs, not at one run alone.
 * Labels name the test and project only: the suite is part of the Pushgateway grouping key.
 */
export function runMetrics(run: StoredRun, history: StoredRun[] = [run]): string {
  const summary = summarize(run);
  const outcomes = outcomesOf(run.results);
  const suiteHistory = history.filter((r) => r.run.suite === run.run.suite);
  const trends = metricTrends(suiteHistory);
  const latestMetrics = outcomes.flatMap((o) => {
    const final = run.results.filter((r) => r.testId === o.testId).sort((a, b) => b.retry - a.retry)[0];
    return Object.entries(final?.metrics ?? {}).map(([metric, value]) => ({
      labels: { test: o.title, project: o.project, metric },
      value,
    }));
  });
  return render([
    {
      name: 'aiqa_run_tests',
      help: 'Tests in the latest run, by outcome (flaky: failed first, then passed on a retry).',
      samples: (['passed', 'failed', 'flaky', 'skipped'] as const).map((status) => ({
        labels: { status },
        value: summary[status],
      })),
    },
    {
      name: 'aiqa_run_pass_rate',
      help: 'Share of executed tests that ended green in the latest run, 0 to 100.',
      samples: [{ value: summary.passRate }],
    },
    {
      name: 'aiqa_run_duration_seconds',
      help: 'Wall-clock time of the latest run.',
      samples: [{ value: summary.durationMs / 1000 }],
    },
    {
      name: 'aiqa_run_finished_timestamp_seconds',
      help: 'When the latest run finished (Unix time).',
      samples: [{ value: Math.round(Date.parse(run.run.finishedAt) / 1000) }],
    },
    {
      name: 'aiqa_flaky_tests',
      help: 'Tests that both passed and failed across the recent runs of this suite.',
      samples: [{ value: detectFlaky(suiteHistory).length }],
    },
    {
      name: 'aiqa_perf_regressions',
      help: 'Performance metrics more than 20% worse than the median of their previous runs.',
      samples: [{ value: trends.filter((t) => t.verdict === 'regressed').length }],
    },
    {
      name: 'aiqa_test_duration_seconds',
      help: 'Time spent on each of the ten slowest tests of the latest run, retries included.',
      samples: slowest(outcomes, 10).map((o) => ({
        labels: { test: o.title, project: o.project },
        value: o.durationMs / 1000,
      })),
    },
    {
      name: 'aiqa_test_metric',
      help: 'Performance numbers the tests recorded (metric names carry their unit: _ms, _bytes).',
      samples: latestMetrics,
    },
  ]);
}

/**
 * Pushes a run's metrics, replacing the previous set for its suite (HTTP PUT). Never throws:
 * monitoring must not fail a test run. Returns whether the push worked.
 */
export async function pushRunMetrics(
  gatewayUrl: string,
  run: StoredRun,
  history: StoredRun[] = [run],
): Promise<boolean> {
  const url = `${gatewayUrl.replace(/\/$/, '')}/metrics/job/aiqa_tests/suite/${encodeURIComponent(run.run.suite)}`;
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain; version=0.0.4' },
      body: runMetrics(run, history),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
    return true;
  } catch (error) {
    console.warn(`[aiqa] test metrics were not pushed to ${gatewayUrl}: ${(error as Error).message}`);
    return false;
  }
}
