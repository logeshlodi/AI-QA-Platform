# 0011. Contracts: an OpenAPI document generated from zod, and Pact for the consumers

Accepted, November 2026.

## Context

The order service now has an HTTP API (used by the load tests) and publishes Kafka events. The
Phase 1 plan postponed OpenAPI validation (no public target publishes a document) and Pact (no
provider we control). The order service removes both obstacles.

## Decision

- The service builds its OpenAPI 3.1 document at run time from the same zod schemas it validates
  requests with (`apps/order-service/src/api.ts`) and serves it at `GET /openapi.json`. A unit test
  checks the document is valid OpenAPI 3.1 and that its schemas still tell a good body from a bad one.
- The data suite fetches that document from the running service and checks every response it can
  provoke against it, with Ajv (JSON Schema 2020-12). A test proves the checker can fail.
- Pact V4 records two consumers: a storefront over HTTP and a notifications service over Kafka. The
  provider check replays HTTP interactions against the running service with state handlers, and checks
  messages against the service's own event builders (`events.ts`), the code main.ts publishes with.

## Consequences

A breaking change shows up from both sides: the OpenAPI check catches a response that no longer matches
what the provider promised, and Pact catches a change to something a consumer reads. Generating the
document from code means it cannot fall behind, but it also cannot lead: design-first would write the
document first. No Pact Broker: pacts travel as a CI artifact. Pact's core has a native library per
platform (installed as an optional dependency) and anonymous usage tracking, which is switched off.
