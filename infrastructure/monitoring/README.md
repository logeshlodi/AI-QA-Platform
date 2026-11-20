# monitoring

The monitoring configuration lives with the Helm chart, in
[`../kubernetes/aiqa-stack/files`](../kubernetes/aiqa-stack/files), so the Docker stack and the
Kubernetes cluster use the same files.

| What                 | Docker stack (`pnpm stack:up`) | Kubernetes (`pnpm k8s:up`)  |
| -------------------- | ------------------------------ | --------------------------- |
| Prometheus           | http://localhost:9090          | http://localhost:30090      |
| Grafana              | http://localhost:3000          | http://localhost:30300      |
| Pushgateway          | http://localhost:9091          | http://localhost:30091      |
| Logs (Loki, Alloy)   | not included                   | in Grafana, Explore > Loki  |
| Traces (Tempo, OTel) | not included                   | in Grafana, Explore > Tempo |

## Dashboards

- **Order service**: orders by outcome (confirmed, rejected, dead-lettered), processing time p50 and p95.
- **Load tests (k6)**: k6 pushes its metrics to Prometheus (remote write) during `pnpm perf:load`
  and `pnpm k8s:test load`, next to the service's own processing time.
- **Test runs**: the tests themselves. Pass rate and duration per suite over time, failed and
  flaky counts, performance regressions, the slowest tests and the performance numbers of the
  latest run (web vitals, page weight, k6 percentiles).

## How test results reach Grafana

When `AIQA_PUSHGATEWAY` is set, the run-history reporter pushes a summary of each finished run to
the Pushgateway (`PUT /metrics/job/aiqa_tests/suite/<suite>`), and Prometheus scrapes it. Each suite
keeps one group of metrics, replaced on every run, so the gauges always describe the latest run and
Prometheus keeps the history. The push has a 5-second timeout and never fails a test run.

| Metric                                     | Meaning                                      |
| ------------------------------------------ | -------------------------------------------- |
| `aiqa_run_tests{status}`                   | Tests by status in the latest run            |
| `aiqa_run_pass_rate`                       | Passed out of passed + failed, in percent    |
| `aiqa_run_duration_seconds`                | Wall-clock time of the run                   |
| `aiqa_run_finished_timestamp_seconds`      | When the run ended                           |
| `aiqa_flaky_tests`                         | Flaky tests over the recent run history      |
| `aiqa_perf_regressions`                    | Performance numbers outside their trend      |
| `aiqa_test_duration_seconds{test,project}` | The ten slowest tests of the latest run      |
| `aiqa_test_metric{test,project,metric}`    | Numbers a test recorded (LCP, bytes, p95...) |

In the cluster every test Job sets `AIQA_PUSHGATEWAY=http://pushgateway:9091`. On the laptop, set
`AIQA_PUSHGATEWAY=http://localhost:9091` (Docker) or `http://localhost:30091` (Kubernetes).

## Logs and traces

Grafana Alloy tails every pod in the `aiqa` namespace and sends the logs to Loki, labelled with
`app`, `pod`, `container` and, for test Jobs, `suite`. The order service sends OpenTelemetry traces
to Tempo: one order is one trace, from `POST /orders` through the Kafka message (the trace context
travels in the message headers) to the Postgres transaction and the MongoDB audit writes. Its log
lines carry the `traceId`, and Grafana links a log line to its trace and a trace back to its logs.
Tempo also writes service-graph metrics to Prometheus.
