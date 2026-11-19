import { Kafka, logLevel, type Consumer, type Producer } from 'kafkajs';

export interface BusMessage {
  topic: string;
  partition: number;
  offset: string;
  key: string | null;
  value: string | null;
  json: unknown;
}

/**
 * Adapter: the suites talk to this, not to kafkajs, so swapping the Kafka client is one file.
 *
 * Reading results: one "tap" consumer per worker reads the output topics from the beginning with a
 * group of its own, and keeps every message in memory. A test then waits for the message it caused
 * (matched by its own unique order id). Reading from the beginning means a result can never be
 * missed because the consumer joined a moment after the service replied.
 */
export class KafkaBus {
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private tap?: Consumer;
  private readonly seen: BusMessage[] = [];
  private tapReady?: Promise<void>;

  constructor(brokers: string[], clientId = `aiqa-tests-${process.pid}`) {
    this.kafka = new Kafka({ clientId, brokers, logLevel: logLevel.NOTHING });
    this.producer = this.kafka.producer();
  }

  async connect(tapTopics: string[]): Promise<void> {
    await this.producer.connect();
    this.tap = this.kafka.consumer({ groupId: `aiqa-tap-${process.pid}-${Date.now()}` });
    await this.tap.connect();
    await this.tap.subscribe({ topics: tapTopics, fromBeginning: true });
    this.tapReady = new Promise((resolve) => {
      const off = this.tap!.on(this.tap!.events.GROUP_JOIN, () => {
        off();
        resolve();
      });
    });
    await this.tap.run({
      eachMessage: async ({ topic, partition, message }) => {
        const value = message.value?.toString() ?? null;
        let json: unknown;
        try {
          json = value === null ? undefined : JSON.parse(value);
        } catch {
          json = undefined;
        }
        this.seen.push({
          topic,
          partition,
          offset: message.offset,
          key: message.key?.toString() ?? null,
          value,
          json,
        });
      },
    });
    await this.tapReady;
  }

  /** Sends one message. `value` may be any string, so tests can send malformed payloads. */
  async publish(topic: string, key: string, value: unknown): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{ key, value: typeof value === 'string' ? value : JSON.stringify(value) }],
    });
  }

  /** Messages seen so far on a topic that match a predicate. */
  messages(topic: string, match: (m: BusMessage) => boolean = () => true): BusMessage[] {
    return this.seen.filter((m) => m.topic === topic && match(m));
  }

  async disconnect(): Promise<void> {
    await Promise.allSettled([this.tap?.disconnect(), this.producer.disconnect()]);
  }

  /** The raw client, for the topic and admin tests that need it. */
  get client(): Kafka {
    return this.kafka;
  }
}
