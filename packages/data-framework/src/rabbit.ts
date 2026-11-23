import { randomUUID } from 'node:crypto';
import amqp, {
  type Channel,
  type ChannelModel,
  type ConsumeMessage,
  type GetMessage,
  type Options,
} from 'amqplib';

/** The order service's notification exchange and routing keys (apps/order-service/src/notifications.ts). */
export const NOTIFICATIONS = {
  exchange: 'orders.events',
  confirmed: 'order.confirmed',
  rejected: 'order.rejected',
  deadLettered: 'order.dead-lettered',
} as const;

export interface RabbitMessage {
  routingKey: string;
  exchange: string;
  redelivered: boolean;
  properties: ConsumeMessage['properties'];
  body: string;
  json: unknown;
}

const toMessage = (m: ConsumeMessage | GetMessage): RabbitMessage => {
  const body = m.content.toString('utf8');
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    json = undefined;
  }
  return {
    routingKey: m.fields.routingKey,
    exchange: m.fields.exchange,
    redelivered: m.fields.redelivered,
    properties: m.properties,
    body,
    json,
  };
};

/** A queue a test listens on: what it has received so far, and a way to stop. */
export interface Listener {
  readonly queue: string;
  readonly messages: RabbitMessage[];
  stop(): Promise<void>;
}

/**
 * Adapter: the RabbitMQ suites talk to this, never to amqplib directly. Every queue a test makes has a
 * unique name and is deleted afterwards, so tests run in parallel and leave the broker as they found it.
 */
export class RabbitBus {
  private connection?: ChannelModel;
  private channel?: Channel;
  private readonly made: { kind: 'queue' | 'exchange'; name: string }[] = [];

  constructor(private readonly url: string) {}

  async connect(): Promise<void> {
    this.connection = await amqp.connect(this.url);
    this.channel = await this.connection.createChannel();
  }

  get ch(): Channel {
    if (!this.channel) throw new Error('RabbitBus is not connected');
    return this.channel;
  }

  /** A fresh channel, for tests about one consumer's behaviour (prefetch, closing without an ack). */
  async newChannel(): Promise<Channel> {
    if (!this.connection) throw new Error('RabbitBus is not connected');
    return this.connection.createChannel();
  }

  /** A uniquely named queue, deleted on disconnect. */
  async queue(prefix: string, options: Options.AssertQueue = {}): Promise<string> {
    const name = `aiqa.test.${prefix}.${randomUUID()}`;
    // Durable unless exclusive: RabbitMQ 4 refuses transient queues that are not exclusive
    // (deprecated feature transient_nonexcl_queues). Deleted on disconnect either way.
    await this.ch.assertQueue(name, { durable: !options.exclusive, ...options });
    this.made.push({ kind: 'queue', name });
    return name;
  }

  /** A uniquely named exchange, deleted on disconnect. */
  async exchange(prefix: string, type: 'direct' | 'topic' | 'fanout'): Promise<string> {
    const name = `aiqa.test.${prefix}.${randomUUID()}`;
    await this.ch.assertExchange(name, type, { durable: false });
    this.made.push({ kind: 'exchange', name });
    return name;
  }

  /** Binds a fresh queue to an exchange and collects what arrives, acknowledging each message. */
  async listen(exchange: string, pattern: string): Promise<Listener> {
    const queue = await this.queue('listen', { exclusive: true });
    await this.ch.bindQueue(queue, exchange, pattern);
    return this.consume(queue);
  }

  /** Collects every message of a queue, acknowledging each. */
  async consume(queue: string): Promise<Listener> {
    const messages: RabbitMessage[] = [];
    const { consumerTag } = await this.ch.consume(queue, (m) => {
      if (!m) return;
      messages.push(toMessage(m));
      this.ch.ack(m);
    });
    return { queue, messages, stop: async () => void (await this.ch.cancel(consumerTag)) };
  }

  /** One message from a queue, or undefined when it is empty (basic.get, no consumer). */
  async get(queue: string): Promise<(RabbitMessage & { raw: GetMessage }) | undefined> {
    const m = await this.ch.get(queue, { noAck: false });
    if (!m) return undefined;
    return { ...toMessage(m), raw: m };
  }

  publish(exchange: string, routingKey: string, body: unknown, options: Options.Publish = {}): boolean {
    const content = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    return this.ch.publish(exchange, routingKey, content, { contentType: 'application/json', ...options });
  }

  /** How many messages wait in a queue. */
  async depth(queue: string): Promise<number> {
    return (await this.ch.checkQueue(queue)).messageCount;
  }

  async disconnect(): Promise<void> {
    const ch = this.channel;
    if (ch) {
      for (const { kind, name } of this.made.reverse()) {
        await (kind === 'queue' ? ch.deleteQueue(name) : ch.deleteExchange(name)).catch(() => undefined);
      }
    }
    await this.connection?.close().catch(() => undefined);
  }
}
