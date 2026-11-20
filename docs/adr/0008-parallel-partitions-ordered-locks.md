# 0008. Parallel partitions, in order within each, stock locked in SKU order

Accepted, November 2026.

## Context

A stress test showed the order service handling one Kafka message at a time. Processing in parallel risks two things: events for one order arriving out of order, and two orders deadlocking on the same products.

## Decision

One worker per partition: partitions run in parallel, each one in order. Offsets are committed after an order is handled. Each order locks its products in SKU order, so two orders always lock shared rows in the same order; a transaction Postgres still aborts as a deadlock (40P01) or serialization failure (40001) is retried.

## Consequences

Throughput rose to what the stress test asked for, with every order confirmed. A regression spec places conflicting orders concurrently and checks none is lost.
