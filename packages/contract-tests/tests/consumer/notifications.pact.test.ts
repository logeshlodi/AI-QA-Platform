import path from 'node:path';
import { MatchersV3, PactV4 } from '@pact-foundation/pact';
import { describe, expect, it } from 'vitest';
import { STATES } from '../../src/examples';
import { onOrderConfirmed, onOrderRejected } from '../../src/notifications';

const { equal, integer, string, uuid } = MatchersV3;

// Consumer side of the notifications <- order-service message contract: the Kafka events, not HTTP.
// Pact hands each example message to the real handler, as Kafka would. The provider check then asks
// the order service's own event builders for the same messages and compares them with this contract.

const pact = new PactV4({
  consumer: 'notifications',
  provider: 'order-service',
  dir: path.resolve(__dirname, '../../pacts'),
  logLevel: 'warn',
});

describe('notifications <- order-service events', () => {
  it('turns an orders.confirmed event into a confirmation', async () => {
    await pact
      .addAsynchronousInteraction()
      .given(STATES.orderWasConfirmed)
      .expectsToReceive('an order confirmed event', (b) =>
        b
          .withJSONContent({
            orderId: uuid('7d1c5a8e-3f2b-4c6d-9e8a-1b2c3d4e5f60'),
            totalCents: integer(2500),
          })
          .withMetadata({ topic: equal('orders.confirmed') }),
      )
      .executeTest(async (message) => {
        expect(onOrderConfirmed(message.contents.content)).toEqual({
          orderId: '7d1c5a8e-3f2b-4c6d-9e8a-1b2c3d4e5f60',
          text: 'Your order is confirmed. Total: $25.00.',
        });
      });
  });

  it('turns an orders.rejected event into an apology with the reason', async () => {
    await pact
      .addAsynchronousInteraction()
      .given(STATES.orderWasRejected)
      .expectsToReceive('an order rejected event', (b) =>
        b
          .withJSONContent({
            orderId: uuid('7d1c5a8e-3f2b-4c6d-9e8a-1b2c3d4e5f60'),
            reason: string('insufficient stock for PACT-SKU-1: wanted 2, have 0'),
          })
          .withMetadata({ topic: equal('orders.rejected') }),
      )
      .executeTest(async (message) => {
        expect(onOrderRejected(message.contents.content).text).toBe(
          'Sorry, we could not take your order: insufficient stock for PACT-SKU-1: wanted 2, have 0.',
        );
      });
  });
});
