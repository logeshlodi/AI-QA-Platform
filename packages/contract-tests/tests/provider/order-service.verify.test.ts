import { existsSync } from 'node:fs';
import path from 'node:path';
import { providerWithMetadata, Verifier } from '@pact-foundation/pact';
import { beforeAll, describe, it } from 'vitest';
import { TOPICS } from '@aiqa/order-service/config';
import { confirmedEvent, rejectedEvent } from '@aiqa/order-service/events';
import { exampleOrder, PACT_PRODUCT, STATES } from '../../src/examples';

// Provider side: the order service is checked against what its consumers wrote down.
//  - HTTP: Pact replays every storefront interaction against the running service (ORDER_SERVICE_URL,
//    default http://localhost:8088, which `pnpm stack:up` provides) after setting up each provider state.
//  - Messages: there is no HTTP call to replay, so Pact asks for each message by its description and
//    gets it from the service's own event builders, the same functions main.ts publishes with.
// The pacts come from the consumer tests (`pnpm test:contract` runs those first).

const SERVICE = process.env.ORDER_SERVICE_URL ?? 'http://localhost:8088';
const pactFile = (consumer: string) => path.resolve(__dirname, `../../pacts/${consumer}-order-service.json`);

async function call(method: string, route: string, body?: unknown): Promise<Response> {
  return fetch(new URL(route, SERVICE), {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function putContractProduct(): Promise<void> {
  const { sku, ...fields } = PACT_PRODUCT;
  const response = await call('PUT', `/products/${sku}`, fields);
  if (!response.ok) throw new Error(`could not set up ${sku}: ${response.status} ${await response.text()}`);
}

/** Places the order (a repeat of an earlier run is ignored as a duplicate) and waits until it is confirmed. */
async function confirmedOrder(orderId: string): Promise<void> {
  await putContractProduct();
  const placed = await call('POST', '/orders', exampleOrder(orderId));
  if (placed.status !== 202) throw new Error(`could not place order ${orderId}: ${placed.status}`);
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const stored = await call('GET', `/orders/${orderId}`);
    if (stored.ok) {
      const { status } = (await stored.json()) as { status: string };
      if (status === 'confirmed') return;
      throw new Error(
        `order ${orderId} is ${status}, so the "${STATES.orderConfirmed}" state cannot be set up`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`order ${orderId} was not confirmed within 20 seconds`);
}

const orderIdFrom = (params: unknown) => (params as { orderId: string }).orderId;

function requirePact(consumer: string): void {
  if (!existsSync(pactFile(consumer))) {
    throw new Error(`${pactFile(consumer)} is missing: run the consumer tests first (pnpm test:contract)`);
  }
}

describe('order-service honours the storefront contract (HTTP)', () => {
  beforeAll(async () => {
    requirePact('storefront');
    const health = await fetch(new URL('/health', SERVICE)).catch(() => undefined);
    if (!health?.ok)
      throw new Error(`the order service is not ready at ${SERVICE}: start it with pnpm stack:up`);
  });

  it('every interaction, replayed against the running service', async () => {
    await new Verifier({
      provider: 'order-service',
      providerBaseUrl: SERVICE,
      pactUrls: [pactFile('storefront')],
      logLevel: 'warn',
      stateHandlers: {
        [STATES.productInStock]: putContractProduct,
        [STATES.orderConfirmed]: (params) => confirmedOrder(orderIdFrom(params)),
        // Nothing to set up: the id is one no test ever creates.
        [STATES.noSuchOrder]: async () => undefined,
      },
    }).verifyProvider();
  });
});

// No running service needed: the messages come from the event builders.
describe('order-service honours the notifications contract (Kafka events)', () => {
  beforeAll(() => requirePact('notifications'));

  it('every event, built by the service’s own code', async () => {
    const order = exampleOrder('7d1c5a8e-3f2b-4c6d-9e8a-1b2c3d4e5f60');
    await new Verifier({
      provider: 'order-service',
      pactUrls: [pactFile('notifications')],
      logLevel: 'warn',
      stateHandlers: {
        // The events are built from the order alone; there is nothing to set up.
        [STATES.orderWasConfirmed]: async () => undefined,
        [STATES.orderWasRejected]: async () => undefined,
      },
      messageProviders: {
        'an order confirmed event': providerWithMetadata(() => confirmedEvent(order), {
          topic: TOPICS.confirmed,
        }),
        'an order rejected event': providerWithMetadata(
          () => rejectedEvent(order, `insufficient stock for ${PACT_PRODUCT.sku}: wanted 2, have 0`),
          { topic: TOPICS.rejected },
        ),
      },
    }).verifyProvider();
  });
});
