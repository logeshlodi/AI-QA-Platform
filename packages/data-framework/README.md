# @aiqa/data-framework

Postgres, MongoDB and Kafka suites against `apps/order-service`, run by Playwright's test runner
(no browser). Start the stack first: `npx pnpm stack:up`, then `npx pnpm test:data`.
Or do both in containers with one command: `npx pnpm stack:test`.

| Folder           | What it checks                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/postgres` | Columns, check and foreign-key constraints (each in a rolled-back transaction), data-quality queries over every stored order               |
| `tests/mongodb`  | The unique index that makes audit writes idempotent; every audit document against a zod schema                                             |
| `tests/kafka`    | Topic layout; same key, same partition, same order                                                                                         |
| `tests/flows`    | Kafka in, Postgres and MongoDB, Kafka out: confirmed, rejected for stock, unknown SKU, duplicate delivery, four dead-letter cases, metrics |
| `tests/http`     | The HTTP API: products, orders, refusals; every response checked against the service's own OpenAPI document (`src/openapi.ts`)             |

Patterns worth reading: test data from `@aiqa/test-data-engine` with a seed recorded on each test
(`AIQA_SEED` replays it); a worker-wide Kafka "tap" that reads output topics from the beginning so a
reply can never be missed; idempotency proved through the service's own metrics instead of a sleep.
