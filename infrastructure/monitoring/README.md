# monitoring

**Service monitoring is built** and lives in [`../observability`](../observability): Prometheus scrapes
the order service's metrics, and Grafana shows them on a provisioned dashboard. Both start with
`pnpm stack:up` (Grafana on http://localhost:3000, Prometheus on http://localhost:9090).
The **Load tests (k6)** dashboard shows `pnpm perf:load` runs: k6 pushes its metrics to Prometheus
(remote write), next to the service's own processing time.

**Not built yet: monitoring of the tests themselves.** Run results, pass rates, durations and flaky
tests are recorded in the run history (`pnpm report:dashboard`) but not yet in Grafana. Planned for the
Kubernetes and monitoring sprint, together with load-test results from the performance sprint.
