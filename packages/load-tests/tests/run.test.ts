import { describe, expect, it } from 'vitest';
import { keyMetrics } from '../src/run';

// Shape of k6's --summary-export file: trends carry their summaryTrendStats, rates a value,
// counters a count. Tagged sub-metrics appear under their threshold names.
const summary = {
  metrics: {
    order_end_to_end: { avg: 180.2, med: 151.37, 'p(95)': 402.44, max: 900 },
    'http_req_duration{name:POST /orders}': { 'p(95)': 12.345 },
    'http_req_duration{name:GET /orders/:id}': { 'p(95)': 8.01 },
    http_req_failed: { value: 0.0025, passes: 1, fails: 399 },
    orders_confirmed: { value: 0.995 },
    dropped_iterations: { count: 3, rate: 0.1 },
  },
};

describe('keyMetrics', () => {
  it('picks the numbers worth a trend, rounded, with rates as percentages', () => {
    expect(keyMetrics(summary)).toEqual({
      end_to_end_p50_ms: 151.4,
      end_to_end_p95_ms: 402.4,
      post_order_p95_ms: 12.3,
      get_order_p95_ms: 8,
      failed_requests_pct: 0.3,
      unconfirmed_orders_pct: 0.5,
      dropped_orders: 3,
    });
  });

  it('a run with nothing dropped or failed records zeros, and leaves out what k6 did not report', () => {
    expect(
      keyMetrics({ metrics: { http_req_failed: { value: 0 }, orders_confirmed: { value: 1 } } }),
    ).toEqual({
      failed_requests_pct: 0,
      unconfirmed_orders_pct: 0,
      dropped_orders: 0,
    });
  });
});
