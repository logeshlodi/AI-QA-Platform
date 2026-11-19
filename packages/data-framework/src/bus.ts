import { randomUUID } from 'node:crypto';
import {
  Admin,
  Consumer,
  Producer,
  stringDeserializers,
  stringSerializers,
  type Message,
  type MessagesStream,
} from '@platformatic/kafka';

export interface BusMessage {
  topic: string;
  partition: number;
  offset: string;
  key: string | null;
  value: string | null;
  json: unknown;
}

/** A consumer started by `collect()`: the messages it has read so far, and a way to stop it. */
export interface Collector {
  readonly messages: BusMessage[];
  stop(): Promise<void>;
}

type StringConsumer = Consumer<string, string, string, string>;
type StringStream = MessagesStream<string, string, string, string>;

function toBusMessage(message: Message<string, string, string, string>): BusMessage {
  const value = message.value ?? null;
  let json: unknown;
  try {
    json = value === null ? undefined : JSON.parse(value);
  } catch {
    json = undefined;
  }
  return {
    topic: message.topic,
    partition: message.partition,
    offset: message.offset.toString(),
    key: message.key || null,
    value,
    json,
  };
}

/**
 * Adapter: the suites talk to this, never to a Kafka client library, so swapping the client is one
 * file. The client is @platformatic/kafka (pure TypeScript, maintained); kafkajs, used until
 * Nov 2026, has had no release since 2023.
 *
 * Reading results: one "tap" consumer per worker reads the output topics from the beginning with a
 * group of its own, and keeps every message in memory. A test then waits for the message it caused
 * (matched by its own unique order id). Reading from the beginning means a result can never be
 * missed because the consumer joined a moment after the service replied.
 */
export class KafkaBus {
  private readonly producer: Producer<string, string, string, string>;
  private readonly admin: Admin;
  private readonly collectors = new Set<Collector>();
  private tap?: Collector;

  constructor(
    private readonly brokers: string[],
    private readonly clientId = `aiqa-tests-${process.pid}`,
  ) {
    this.producer = new Producer({ clientId, bootstrapBrokers: brokers, serializers: stringSerializers });
    this.admin = new Admin({ clientId: `${clientId}-admin`, bootstrapBrokers: brokers });
  }

  async connect(tapTopics: string[]): Promise<void> {
    this.tap = await this.collect(tapTopics);
  }

  /**
   * Starts a consumer in a new group that reads `topics` from the beginning and keeps every message.
   * Resolves once the consumer has joined its group, so nothing sent afterwards can be missed.
   */
  async collect(topics: string | string[]): Promise<Collector> {
    const consumer: StringConsumer = new Consumer({
      clientId: `${this.clientId}-${randomUUID().slice(0, 8)}`,
      groupId: `aiqa-tap-${process.pid}-${randomUUID()}`,
      bootstrapBrokers: this.brokers,
      deserializers: stringDeserializers,
      maxWaitTime: 500,
    });
    const joined = new Promise<void>((resolve) => consumer.once('consumer:group:join', () => resolve()));
    const stream: StringStream = await consumer.consume({
      topics: Array.isArray(topics) ? topics : [topics],
      mode: 'earliest',
      autocommit: true,
    });
    await joined;

    const messages: BusMessage[] = [];
    stream.on('data', (message: Message<string, string, string, string>) =>
      messages.push(toBusMessage(message)),
    );
    stream.on('error', () => undefined); // surfaces as a missing message in the test that waits for it

    const collector: Collector = {
      messages,
      stop: async () => {
        this.collectors.delete(collector);
        await stream.close().catch(() => undefined);
        await consumer.close(true).catch(() => undefined);
      },
    };
    this.collectors.add(collector);
    return collector;
  }

  /** Sends one message. `value` may be any string, so tests can send malformed payloads. */
  async publish(topic: string, key: string, value: unknown): Promise<void> {
    await this.producer.send({
      messages: [{ topic, key, value: typeof value === 'string' ? value : JSON.stringify(value) }],
    });
  }

  /** Messages the tap has seen so far on a topic that match a predicate. */
  messages(topic: string, match: (m: BusMessage) => boolean = () => true): BusMessage[] {
    return (this.tap?.messages ?? []).filter((m) => m.topic === topic && match(m));
  }

  /** Partition count per topic, read from the cluster's metadata. */
  async partitionCounts(topics: string[]): Promise<Record<string, number>> {
    const metadata = await this.admin.metadata({ topics, forceUpdate: true });
    return Object.fromEntries(topics.map((t) => [t, metadata.topics.get(t)?.partitionsCount ?? 0]));
  }

  async createTopic(topic: string, partitions: number): Promise<void> {
    await this.admin.createTopics({ topics: [topic], partitions, replicas: 1 });
  }

  async deleteTopic(topic: string): Promise<void> {
    await this.admin.deleteTopics({ topics: [topic] });
  }

  async disconnect(): Promise<void> {
    await Promise.allSettled([...this.collectors].map((c) => c.stop()));
    await Promise.allSettled([this.producer.close(), this.admin.close()]);
  }
}
