# order-service

A small, real system for the data and messaging suites to test. It is not a product; it exists
so the tests have something with genuine moving parts.

```
orders.placed (Kafka) -> validate -> Postgres: order + lines, reserve stock (one transaction)
                                  -> MongoDB: audit trail (received, confirmed or rejected)
                                  -> Kafka: orders.confirmed | orders.rejected | orders.dlq
                                  -> RabbitMQ: orders.events (order.confirmed | order.rejected | order.dead-lettered)
```

- Invalid JSON, schema failures and totals that do not match the lines go to `orders.dlq` with a reason.
- A redelivered order (same id) changes nothing: `ON CONFLICT DO NOTHING` in Postgres, a unique index in MongoDB.
- If any line cannot be reserved (unknown SKU, not enough stock) no stock moves and the order is stored as rejected.
- The three partitions of `orders.placed` are handled in parallel, one message at a time within each, so
  everything about one order (keyed by its id) stays in order. Offsets are committed after handling.
  Stock is reserved in SKU order so concurrent orders cannot deadlock; a deadlock victim is retried.
  `PARALLEL_PARTITIONS=false` handles one message at a time overall, to compare.
- `POST /orders` (checked against the same contract, published to `orders.placed`, answers 202),
  `PUT /products/:sku` (create or replace a product; no authentication, a demo service),
- `GET /health`, `GET /orders/:id` on port 8080 inside the stack (published as 8088 on your machine); OpenTelemetry metrics in Prometheus format on 9464 `/metrics`.

- A gRPC API on port 50051 (`proto/orders.proto`): `PlaceOrder` and `GetOrder` do what `POST /orders`
  and `GET /orders/:id` do, against the same contract; `WatchOrder` streams an order's status until it
  is decided, bounded by the client's deadline.
- With `RABBITMQ_URL` set, every outcome is also published on the RabbitMQ topic exchange
  `orders.events`: persistent, JSON, the order id as message id, after the broker confirms. Kafka stays
  the record; a notification that cannot be sent is logged and never stops an order
  (`src/notifications.ts`).

Runs in the Docker stack: `npx pnpm stack:up` (see the root README).

## HTTP API and contracts

`GET /openapi.json` serves the API's OpenAPI 3.1 document, built from the zod schemas the service
validates requests with (`src/api.ts`), so it cannot drift from the code. The Kafka events are built
only in `src/events.ts`; the Pact provider check (`packages/contract-tests`) calls the same functions.
