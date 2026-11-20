# 0010. Test results reach Prometheus through a Pushgateway

Accepted, November 2026.

## Context

Prometheus pulls metrics from long-running processes. A test run is short and ends before it could be scraped.

## Decision

At the end of a run the history reporter PUTs a summary to a Pushgateway, one group per suite, replaced on every run. Prometheus scrapes the gateway, and Grafana's "Test runs" dashboard reads Prometheus. The push has a 5-second timeout and never fails a run.

## Consequences

Pass rates, durations, flaky counts and performance numbers sit next to the service metrics. Only the latest run per suite is in the gateway; history over time comes from Prometheus's own storage.
