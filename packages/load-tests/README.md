# @aiqa/load-tests

A k6 load test of the order service: it places orders over HTTP and times each one end to end, from
`POST /orders` until `GET /orders/:id` reads `confirmed`, through Kafka, Postgres and MongoDB.

```bash
npx pnpm stack:up             # the order service and its stack (Docker)
npx pnpm perf:load            # smoke: 2 orders a second for 30 seconds
npx pnpm perf:load load       # ramp to 20 orders a second, hold 2 minutes
npx pnpm perf:load stress     # keep climbing to 150 a second: find where it breaks
npx pnpm aiqa perf            # the numbers against their usual level
```

k6 runs in its own Docker image (`grafana/k6`), so nothing is installed on your machine. Watch a run
live in Grafana (http://localhost:3000, dashboard **Load tests (k6)**).

| File                    | What it does                                                                                                                                                                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/order-flow.js` | The k6 script: stocks 20 products in `setup()`, then places orders at a fixed arrival rate and polls for the outcome (25 ms first, backing off to 500 ms). Thresholds: under 1% failed requests, p95 under 300 ms (POST) and 200 ms (GET), end-to-end p95 under 2 s, over 99% confirmed. |
| `src/run.ts`            | `pnpm perf:load`: starts k6 through Docker Compose (`--profile perf`), then records the key numbers in the run history (suite `load`) and exits with k6's code (99 when a threshold was crossed).                                                                                        |

Load is aimed at the order service only. Never point it at a public demo site.

Notes:

- Arrival-rate executors start orders at a fixed pace whatever the response times, like real
  customers. A fixed number of looping users would slow down with the service and hide the problem.
- k6 2.x prints a deprecation warning for the Prometheus remote-write output (`experimental-prometheus-rw`):
  it is planned for removal in k6 3, with OpenTelemetry as the replacement. It works in 2.x.
