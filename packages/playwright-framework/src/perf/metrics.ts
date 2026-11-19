import type { TestInfo } from '@playwright/test';

/** Annotation type the run history reads metrics from. Keep equal to `METRIC_ANNOTATION` in reporting-engine. */
export const METRIC_ANNOTATION = 'metric';

/**
 * Records numbers for this test: as `metric` annotations, which the run history stores so the
 * dashboard and `aiqa perf` can show trends and flag regressions, and as one JSON attachment for
 * the HTML report. Name units into the metric: `lcp_ms`, `transfer_bytes`, `cls`.
 * Undefined values (a metric the page never produced) are left out.
 */
export async function recordMetrics(
  testInfo: TestInfo,
  metrics: Record<string, number | undefined>,
  attachmentName = 'metrics',
): Promise<void> {
  const defined = Object.fromEntries(
    Object.entries(metrics).filter(([, v]) => typeof v === 'number'),
  ) as Record<string, number>;
  for (const [name, value] of Object.entries(defined)) {
    testInfo.annotations.push({ type: METRIC_ANNOTATION, description: `${name}=${value}` });
  }
  await testInfo.attach(`${attachmentName}.json`, {
    body: JSON.stringify(defined, null, 2),
    contentType: 'application/json',
  });
}

/** An upper limit per metric, keyed like the metrics themselves. */
export type Budget = Record<string, number>;

/**
 * Compares metrics with a budget and returns one readable line per breach, or an empty list.
 * `expect(overBudget(metrics, budget)).toEqual([])` then fails with every breach listed at once.
 * A budgeted metric that was not measured is a breach too: silence is not a pass.
 */
export function overBudget(metrics: Record<string, number | undefined>, budget: Budget): string[] {
  return Object.entries(budget).flatMap(([name, limit]) => {
    const value = metrics[name];
    if (value === undefined) return [`${name}: not measured (budget ${limit})`];
    return value > limit ? [`${name}: ${value} is over the budget of ${limit}`] : [];
  });
}
