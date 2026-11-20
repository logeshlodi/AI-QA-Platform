import path from 'node:path';
import { MatchersV3, PactV4 } from '@pact-foundation/pact';
import { describe, expect, it } from 'vitest';
import {
  CONFIRMED_ORDER_ID,
  exampleOrder,
  MISSING_ORDER_ID,
  PACT_PRODUCT,
  PACT_SKU,
  PLACED_ORDER_ID,
  STATES,
} from '../../src/examples';
import { OrderRefusedError, StorefrontClient } from '../../src/storefront-client';

const { eachLike, equal, integer, nullValue, string, uuid } = MatchersV3;

// Consumer side of the storefront -> order-service contract. Each test runs the real StorefrontClient
// against Pact's mock server, which answers the way the contract says the order service will. The
// interactions are written to pacts/storefront-order-service.json, which the provider check replays
// against the real service. Matchers say what matters: a uuid, an integer, the exact status.

const pact = new PactV4({
  consumer: 'storefront',
  provider: 'order-service',
  dir: path.resolve(__dirname, '../../pacts'),
  logLevel: 'warn',
});

describe('storefront -> order-service', () => {
  it('places a valid order and gets its id back', async () => {
    const order = exampleOrder(PLACED_ORDER_ID);
    await pact
      .addInteraction()
      .given(STATES.productInStock)
      .uponReceiving('a valid order')
      .withRequest('POST', '/orders', (b) =>
        b.headers({ 'content-type': 'application/json' }).jsonBody(order),
      )
      .willRespondWith(202, (b) =>
        b
          .headers({ 'content-type': 'application/json' })
          .jsonBody({ orderId: uuid(PLACED_ORDER_ID), status: equal('accepted') }),
      )
      .executeTest(async (server) => {
        expect(await new StorefrontClient(server.url).placeOrder(order)).toEqual({
          orderId: PLACED_ORDER_ID,
        });
      });
  });

  it('is told why an order is refused', async () => {
    const order = { ...exampleOrder(PLACED_ORDER_ID), totalCents: 1 };
    await pact
      .addInteraction()
      .uponReceiving('an order whose total does not match its lines')
      .withRequest('POST', '/orders', (b) =>
        b.headers({ 'content-type': 'application/json' }).jsonBody(order),
      )
      .willRespondWith(400, (b) => b.jsonBody({ error: string('totalCents does not match the lines') }))
      .executeTest(async (server) => {
        const placing = new StorefrontClient(server.url).placeOrder(order);
        await expect(placing).rejects.toBeInstanceOf(OrderRefusedError);
        await expect(placing).rejects.toThrow('totalCents does not match the lines');
      });
  });

  it('reads back a confirmed order', async () => {
    await pact
      .addInteraction()
      .given(STATES.orderConfirmed, { orderId: CONFIRMED_ORDER_ID })
      .uponReceiving('a request for a confirmed order')
      .withRequest('GET', `/orders/${CONFIRMED_ORDER_ID}`)
      .willRespondWith(200, (b) =>
        b.headers({ 'content-type': 'application/json' }).jsonBody({
          id: uuid(CONFIRMED_ORDER_ID),
          status: equal('confirmed'),
          totalCents: integer(2500),
          rejectionReason: nullValue(),
          lines: eachLike({ sku: string(PACT_SKU), quantity: integer(2), unitPriceCents: integer(1250) }),
        }),
      )
      .executeTest(async (server) => {
        const order = await new StorefrontClient(server.url).getOrder(CONFIRMED_ORDER_ID);
        expect(order).toMatchObject({ id: CONFIRMED_ORDER_ID, status: 'confirmed', rejectionReason: null });
        expect(order!.lines[0]).toEqual({ sku: PACT_SKU, quantity: 2, unitPriceCents: 1250 });
      });
  });

  it('gets null for an order the service does not have', async () => {
    await pact
      .addInteraction()
      .given(STATES.noSuchOrder, { orderId: MISSING_ORDER_ID })
      .uponReceiving('a request for an order that does not exist')
      .withRequest('GET', `/orders/${MISSING_ORDER_ID}`)
      .willRespondWith(404, (b) => b.jsonBody({ error: string('order not found') }))
      .executeTest(async (server) => {
        expect(await new StorefrontClient(server.url).getOrder(MISSING_ORDER_ID)).toBeNull();
      });
  });

  it('updates a product it already sells', async () => {
    const update = { ...PACT_PRODUCT, priceCents: 1300 };
    await pact
      .addInteraction()
      .given(STATES.productInStock)
      .uponReceiving('a price change for an existing product')
      .withRequest('PUT', `/products/${PACT_SKU}`, (b) =>
        b
          .headers({ 'content-type': 'application/json' })
          .jsonBody({ name: update.name, priceCents: update.priceCents, stock: update.stock }),
      )
      .willRespondWith(200, (b) =>
        b.jsonBody({
          sku: equal(PACT_SKU),
          name: string(update.name),
          priceCents: integer(update.priceCents),
          stock: integer(update.stock),
        }),
      )
      .executeTest(async (server) => {
        expect(await new StorefrontClient(server.url).saveProduct(update)).toEqual(update);
      });
  });
});
