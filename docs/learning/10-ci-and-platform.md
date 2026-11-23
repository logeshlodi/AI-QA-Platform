# CI, observability and Kubernetes

**You will learn:** how the suite runs in three CI systems, how flaky tests are found, how test results
reach Grafana next to the service's own metrics, logs and traces, and how the whole thing runs on
Kubernetes.

## CI

The same stages run on GitHub Actions (`.github/workflows/ci.yml`), Azure DevOps (`azure-pipelines.yml`)
and Jenkins (`Jenkinsfile`). On GitHub:

- One shared setup action (`.github/actions/setup`): Node, pnpm, a cached install, and Playwright
  browsers matched to the installed Playwright version, so an update needs no workflow change.
- The UI specs run in three shards; a final job merges their reports into one, and into the run history.
- Security, contracts, the ZAP scan, the data suites on Docker, browser performance, k6, Lighthouse and
  the visual check each have their own job, so a failure says what kind of problem it is.

## Run history and flaky tests

Every run is recorded (`packages/reporting-engine`). A test is **flaky** when it passed only on a retry,
or flipped between green and red at least twice in recent runs. Going green to red and staying red is a
regression, not flakiness. `pnpm aiqa flaky` lists them; `pnpm report:dashboard` shows trends.

## Observability

| Signal                                                                      | Where it goes                                        |
| --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Service metrics (orders, processing time)                                   | Prometheus, Grafana "Order service"                  |
| k6 load metrics                                                             | OpenTelemetry into Prometheus, "Load tests"          |
| Test results (pass rate, duration, flaky, performance numbers)              | Pushgateway, then Prometheus, "Test runs" (ADR 0010) |
| Logs of every pod                                                           | Loki, through Alloy                                  |
| Traces: one order from `POST /orders` through Kafka to Postgres and MongoDB | Tempo, linked to the logs                            |

## Kubernetes

`pnpm k8s:up` creates a local kind cluster and installs the whole stack from one Helm chart
(`infrastructure/kubernetes/aiqa-stack`). The suites run as Kubernetes Jobs; UI Jobs connect to one
shared Playwright browser server instead of launching browsers. ADR 0009 explains the choices, including
why `exposeNetwork: '<loopback>'` was needed.

## Ideas worth being able to explain

- **Why shard, and what it costs:** wall-clock time against setup cost per shard and a merge step.
- **Retries hide flakiness unless you record them.** CI retries twice; the history marks those passes.
- **A test is a client of the system's telemetry.** When a test fails, the trace id in the service log
  takes you from the failing request to the exact database call.

## Try it

```bash
npx pnpm aiqa history --suite ui
npx pnpm k8s:up && npx pnpm k8s:test data && npx pnpm k8s:status
```

Grafana in the cluster is http://localhost:30300.
