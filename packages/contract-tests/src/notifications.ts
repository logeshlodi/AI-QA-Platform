/**
 * A notifications service that reads the order service's Kafka events and turns them into messages
 * for the customer: the consumer in the message contract. Like the storefront, it reads only what it
 * needs, and it refuses an event it does not understand instead of sending a wrong message.
 */

export interface Notification {
  orderId: string;
  text: string;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** From orders.confirmed. */
export function onOrderConfirmed(event: unknown): Notification {
  if (!isObject(event) || typeof event.orderId !== 'string' || !Number.isInteger(event.totalCents)) {
    throw new Error(`not an order-confirmed event: ${JSON.stringify(event)}`);
  }
  return {
    orderId: event.orderId,
    text: `Your order is confirmed. Total: ${money(event.totalCents as number)}.`,
  };
}

/** From orders.rejected. */
export function onOrderRejected(event: unknown): Notification {
  if (!isObject(event) || typeof event.orderId !== 'string' || typeof event.reason !== 'string') {
    throw new Error(`not an order-rejected event: ${JSON.stringify(event)}`);
  }
  return { orderId: event.orderId, text: `Sorry, we could not take your order: ${event.reason}.` };
}
