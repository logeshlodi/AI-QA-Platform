# 0007. @platformatic/kafka instead of kafkajs

Accepted, November 2026.

## Context

kafkajs, the usual Node Kafka client, is no longer maintained.

## Decision

Use `@platformatic/kafka` (maintained, pure TypeScript, Apache-2.0) in the order service and the test bus. Tests reach Kafka only through `KafkaBus`, so the client library appears in one file.

## Consequences

All data tests pass on it, and faster. Its README lists Kafka 3.5 to 4.2 as tested and the stack runs 4.3; if a broker update breaks something, the broker image can be pinned back.
