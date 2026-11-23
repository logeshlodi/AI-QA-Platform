import amqp, { type ChannelModel, type ConfirmChannel } from 'amqplib';

/**
 * Order outcomes fanned out on RabbitMQ, for whoever wants to be told (e-mail, a warehouse screen).
 * Kafka stays the record: these are notifications, published after the Kafka event and the database
 * write. Only when RABBITMQ_URL is set.
 *
 * One durable topic exchange, `orders.events`, routing keys `order.confirmed`, `order.rejected` and
 * `order.dead-lettered`. Each message is persistent, JSON, with the order id as its message id (so a
 * consumer can drop a redelivered one) and the trace headers (so its work joins the order's trace).
 * Publishing waits for the broker's confirm; a failure is logged and the order carries on, because a
 * notification must never stop an order being handled.
 */
export const EXCHANGE = 'orders.events';
export const ROUTING_KEYS = {
  confirmed: 'order.confirmed',
  rejected: 'order.rejected',
  deadLettered: 'order.dead-lettered',
} as const;

export interface Notifier {
  publish(
    routingKey: string,
    messageId: string,
    body: unknown,
    headers?: Record<string, string>,
  ): Promise<void>;
  close(): Promise<void>;
}

/** No RABBITMQ_URL: nothing is sent. */
export const silentNotifier: Notifier = { publish: async () => undefined, close: async () => undefined };

export function rabbitNotifier(
  url: string,
  log: (message: string, extra?: Record<string, unknown>) => void,
): Notifier {
  let connection: ChannelModel | undefined;
  let channel: Promise<ConfirmChannel> | undefined;

  // Connects on first use and again after the connection drops, so a broker restart heals itself.
  const open = (): Promise<ConfirmChannel> => {
    channel ??= (async () => {
      connection = await amqp.connect(url);
      const reset = () => {
        channel = undefined;
        connection = undefined;
      };
      connection.on('close', reset);
      connection.on('error', (error: Error) => log('rabbitmq connection error', { error: error.message }));
      const ch = await connection.createConfirmChannel();
      await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
      return ch;
    })().catch((error: unknown) => {
      channel = undefined;
      throw error;
    });
    return channel;
  };

  return {
    async publish(routingKey, messageId, body, headers = {}) {
      try {
        const ch = await open();
        ch.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(body)), {
          persistent: true,
          contentType: 'application/json',
          messageId,
          timestamp: Math.floor(Date.now() / 1000),
          appId: 'order-service',
          headers,
        });
        await ch.waitForConfirms();
      } catch (error) {
        log('notification not published', { routingKey, messageId, error: (error as Error).message });
      }
    },
    async close() {
      await connection?.close().catch(() => undefined);
    },
  };
}
