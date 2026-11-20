# @aiqa/contract-tests

Consumer-driven contracts ([Pact](https://docs.pact.io)) for the order service, from two consumers
that each record only what they rely on:

| Consumer        | Talks to the order service by                | Code                       | Contract                                 |
| --------------- | -------------------------------------------- | -------------------------- | ---------------------------------------- |
| `storefront`    | HTTP: place, read, update a product          | `src/storefront-client.ts` | `pacts/storefront-order-service.json`    |
| `notifications` | Kafka: `orders.confirmed`, `orders.rejected` | `src/notifications.ts`     | `pacts/notifications-order-service.json` |

```bash
npx pnpm test:contract:consumer   # consumer tests: write the pacts (no stack needed)
npx pnpm stack:up                 # the order service and its stack
npx pnpm test:contract            # consumer tests, then the provider check against the running service
```

## How it works

1. **Consumer tests** (`tests/consumer`) run the real client code against Pact's mock server. Each
   interaction says what the consumer sends and the least it needs back: `uuid()`, `integer()`,
   `equal('confirmed')`. Pact writes them to `pacts/` (V4 format).
2. **Provider check** (`tests/provider`) replays the storefront's interactions against the running
   service. Before each one, a _state handler_ creates what the interaction assumes ("an order is
   confirmed": put the product in stock, place the order, wait until it is confirmed).
3. **Messages** have nothing to replay over HTTP, so Pact asks for each event by its description and
   gets it from `confirmedEvent()` and `rejectedEvent()` in `apps/order-service/src/events.ts`: the
   same functions the service publishes with. The topic travels as message metadata and is checked too.

## Why both this and the OpenAPI checks

The data suite checks every response against the service's OpenAPI document (`GET /openapi.json`):
that is the provider's promise to everyone. Pact checks what each consumer actually uses: a field the
storefront reads cannot be renamed, but one nobody reads can. The two together catch a breaking change
before it ships, from both directions.

## Notes

- `PACT_DO_NOT_TRACK=true` is set in `vitest.config.ts`: Pact's core otherwise reports anonymous usage.
  `@scarf/scarf`'s install script is ignored in `pnpm-workspace.yaml` for the same reason.
- There is no Pact Broker here. CI uploads the pacts as an artifact; with a broker, the consumer would
  publish them and the provider would verify the latest from it.
- `pacts/` is regenerated on every consumer run and is not committed.
