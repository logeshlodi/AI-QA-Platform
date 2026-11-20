# Data and messaging

**You will learn:** how to test a service through its database and its message broker: transactions,
constraints, idempotency, ordering, dead letters and concurrency. The system under test is
`apps/order-service`; the tests are in `packages/data-framework/`.

## The system

An order arrives on the Kafka topic `orders.placed` (or over HTTP, which publishes to the same topic).
The service validates it, stores it and reserves stock in Postgres in **one transaction**, writes an
audit trail to MongoDB, and publishes `orders.confirmed`, `orders.rejected` or, for an invalid message,
`orders.dlq`. [`docs/architecture.md`](../architecture.md) has the picture.

## Specs and what each one teaches

| Spec                        | The point                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `postgres/schema.spec.ts`   | Constraints tested directly, each in a rolled-back transaction; data-quality queries over every stored order                                 |
| `mongodb/audit.spec.ts`     | A unique index makes audit writes idempotent; every document checked against a schema                                                        |
| `kafka/topics.spec.ts`      | Three partitions per topic; the same key keeps messages in one partition, in order                                                           |
| `flows/order-flow.spec.ts`  | Confirmed, rejected for stock (and no stock moves: all or nothing), unknown SKU, a duplicate delivery processed once, four dead-letter cases |
| `flows/concurrency.spec.ts` | Orders listing the same products in opposite orders all go through, and stock adds up                                                        |
| `http/orders-api.spec.ts`   | The HTTP front door: 202 Accepted, then the outcome read back                                                                                |
| `http/limits.spec.ts`       | Values the database cannot hold, and a bad message that must not stop the partition behind it                                                |

## Ideas worth being able to explain

- **Asynchronous outcomes need polling, not sleeping.** The specs publish, then
  `expect.poll(...)` until the outcome appears or a timeout says it never will.
- **At-least-once delivery means duplicates.** Kafka can deliver a message twice; the service must
  process it once. The duplicate-delivery test sends the same order twice and counts the effects.
- **Ordering is per partition.** Kafka orders messages only within a partition, and the key picks the
  partition. That is why the service keys every order event by order id.
- **A poison message.** A message that fails every time it is processed blocks everything behind it on
  its partition if the consumer stops on errors. The ZAP scan found one (ADR 0013, `limits.spec.ts`).
- **Deadlocks under concurrency.** Two transactions locking the same rows in opposite orders deadlock.
  The service locks stock in SKU order, and retries the rare deadlock Postgres still reports (ADR 0008).
- **Tests share one stack**, so each creates its own products with random SKUs and cleans up after
  itself (the `stockProducts` fixture).

## Try it

```bash
npx pnpm stack:up            # Postgres, MongoDB, Kafka, Keycloak, the service, Prometheus, Grafana
npx pnpm test:data
npx pnpm stack:test          # build, start, run in a container, stop: what CI does
```

Open Grafana at http://localhost:3000 while the suite runs: orders by outcome, processing time.
