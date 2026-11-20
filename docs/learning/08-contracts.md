# Contracts

**You will learn:** the two kinds of API contract (what a provider promises, what each consumer relies
on), how to test both, and why you want both. ADR 0011 has the reasons.

## The provider's promise: OpenAPI

The order service builds its OpenAPI 3.1 document from the same zod schemas it uses to check requests
(`apps/order-service/src/api.ts`) and serves it at `GET /openapi.json`. The document cannot drift from
the code, because it is generated from the code.

- `apps/order-service/tests/api.test.ts`: the document is valid OpenAPI 3.1, and its schemas still tell
  a good body from a bad one. A schema that accepts everything would make every check pass.
- `packages/data-framework/tests/http/openapi.spec.ts`: every response the running service can be made
  to give is checked against the document it publishes (`src/openapi.ts`, with Ajv). The last test
  proves the checker can fail.

## The consumers' needs: Pact

`packages/contract-tests` has two consumers that each write down only what they rely on:

| Consumer        | Talks to the service by | Contract checked against                                                             |
| --------------- | ----------------------- | ------------------------------------------------------------------------------------ |
| `storefront`    | HTTP                    | The running service, after a state handler sets up each interaction's starting point |
| `notifications` | Kafka events            | The service's own event builders in `events.ts`, the functions it publishes with     |

1. Consumer tests run the real client code against Pact's mock server and write a pact file.
2. The provider check replays the pact against the real service. "An order is confirmed" is a provider
   state: the handler puts a product in stock, places the order and waits until it is confirmed.
3. Matchers (`uuid()`, `integer()`, `equal('confirmed')`) say what matters about a value, so the
   contract does not break when an id changes.

## Why both

The OpenAPI check catches a response that no longer matches what the provider promised anyone. Pact
catches a change to something a consumer actually uses: a field the storefront reads cannot be renamed,
a field nobody reads can. Together they catch a breaking change before it ships, from both directions.

## Ideas worth being able to explain

- **Consumer-driven** means consumers write the contract and the provider proves it keeps it.
- **Contracts are not functional tests.** They check shape and agreement, not business rules.
- **A broker** (Pact Broker) normally stores contracts between teams and answers "can I deploy?". Here
  the pacts travel as a CI artifact.
- **Messages have contracts too.** The notifications pact pins the `orders.confirmed` and
  `orders.rejected` events, topic included, without a running Kafka.

## Try it

```bash
npx pnpm test:contract:consumer                    # writes the pacts; no stack needed
npx pnpm stack:up && npx pnpm test:contract        # consumers, then the provider check
```

Then break the contract on purpose: in `apps/order-service/src/events.ts`, make `confirmedEvent` send
`totalCents` as a string, and run the provider check. Pact names the field and the reason. Put it back.
