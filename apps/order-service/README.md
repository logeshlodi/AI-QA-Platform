# order-service

A small, real system for the data and messaging suites to test. It is not a product; it exists
so the tests have something with genuine moving parts.

```
orders.placed (Kafka) -> validate -> Postgres: order + lines, reserve stock (one transaction)
                                  -> MongoDB: audit trail (received, confirmed or rejected)
                                  -> Kafka: orders.confirmed | orders.rejected | orders.dlq
```

- Invalid JSON, schema failures and totals that do not match the lines go to `orders.dlq` with a reason.
- A redelivered order (same id) changes nothing: `ON CONFLICT DO NOTHING` in Postgres, a unique index in MongoDB.
- If any line cannot be reserved (unknown SKU, not enough stock) no stock moves and the order is stored as rejected.
- `GET /health`, `GET /orders/:id` on port 8080 inside the stack (published as 8088 on your machine); OpenTelemetry metrics in Prometheus format on 9464 `/metrics`.

Runs in the Docker stack: `npx pnpm stack:up` (see the root README).
