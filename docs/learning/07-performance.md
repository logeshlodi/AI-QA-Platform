# Performance

**You will learn:** what to measure in a browser, how to budget it without flaky timing tests, how to
load-test a service end to end, and how to tell a regression from noise. Browser code in
`packages/playwright-framework/src/perf/` and `tests/performance/`; load tests in `packages/load-tests/`.

## In the browser

| Spec                  | The point                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `web-vitals.spec.ts`  | LCP, CLS, INP, FCP and TTFB with Google's `web-vitals` library, on a login page, a logged-in page and TodoMVC interactions |
| `page-weight.spec.ts` | Requests and bytes from Resource Timing, against a budget (counts and bytes are stable; timings are not)                   |
| `throttled.spec.ts`   | A slow phone connection and CPU through the DevTools Protocol, with its own budget                                         |
| `memory.spec.ts`      | Garbage-collected JS heap after repeated add and delete: steady means no leak                                              |

Budgets are set at Google's "poor" thresholds, not "good": the specs run against public sites over the
internet, so a slow connection must not fail them. The trend catches drift instead: `pnpm aiqa perf`
compares each number with the median of its previous runs and needs three earlier runs before it calls
anything a regression. `PERF_TRACE=1` records a Chrome performance trace for a closer look.

## Under load

`packages/load-tests/scripts/order-flow.js` (k6) places orders over HTTP and times each one end to end:
from `POST /orders` until `GET /orders/:id` says confirmed, through Kafka, Postgres and MongoDB.

| Profile  | Shape                               | Question it answers             |
| -------- | ----------------------------------- | ------------------------------- |
| `smoke`  | 2 orders a second for 30 seconds    | Is everything wired up?         |
| `load`   | Ramp to 20 a second, hold 2 minutes | Does it hold the expected load? |
| `stress` | Keep climbing to 150 a second       | Where does it break, and how?   |

k6 uses an **arrival-rate** executor: new orders start at a fixed pace whatever the response times are,
as real customers do. A fixed number of looping users slows down with the system and hides how bad it
gets.

## The story worth telling in an interview

The first stress run showed far fewer confirmed orders a second than requested. Part of that was the
load test itself polling too hard; once fixed, the honest baseline was about 99 a second, with the
service processing one Kafka message at a time. Processing the three partitions in parallel, each in
order, raised throughput to what the stress test asked for. It also caused a deadlock between two
orders locking the same products in opposite orders, fixed by locking in SKU order with a retry as
backstop, and kept fixed by `flows/concurrency.spec.ts`. Details in `docs/STATUS.md` and ADR 0008.

## Try it

```bash
npx pnpm test:perf
npx pnpm stack:up && npx pnpm perf:load            # smoke; then load, then stress
npx pnpm aiqa perf --all                           # every metric against its usual level
```

Grafana's "Load tests" dashboard (http://localhost:3000) shows k6 and the service side by side.
