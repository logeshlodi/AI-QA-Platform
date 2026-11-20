# 0005. Docker Compose for the data stack, not Testcontainers

Accepted, November 2026.

## Context

The data suites need Postgres, MongoDB, Kafka and the order service. The plan listed Testcontainers.

## Decision

One Docker Compose file (`infrastructure/docker/stack.compose.yml`) starts the whole stack, used by every data suite, the k6 load tests, CI and `pnpm stack:test`.

## Consequences

One stack serves all suites and starts once per run, not once per spec file. CI runners and the laptop already have Docker Compose. Cost: tests share one stack, so each test creates its own records (random ids) instead of relying on a clean database.
