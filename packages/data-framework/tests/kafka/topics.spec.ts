import { randomUUID } from 'node:crypto';
import { expect, test } from '../../src/fixtures';
import { TOPICS } from '../../src/stack';

test.describe('Kafka: topics and delivery guarantees', { tag: '@kafka' }, () => {
  test('the service topics exist with three partitions each', async ({ bus }) => {
    const topics = Object.values(TOPICS);
    expect(await bus.partitionCounts(topics)).toEqual(Object.fromEntries(topics.map((t) => [t, 3])));
  });

  test('messages with the same key stay in one partition, in the order sent', async ({ bus }) => {
    // Kafka only orders messages within a partition; the key decides the partition.
    // That is why the service keys every order event by order id.
    const topic = `aiqa.test.ordering.${randomUUID()}`;
    const key = randomUUID();
    await bus.createTopic(topic, 3);
    const reader = await bus.collect(topic);
    try {
      for (let i = 1; i <= 5; i++) await bus.publish(topic, key, `step-${i}`);
      await expect.poll(() => reader.messages.length).toBe(5);
      expect(new Set(reader.messages.map((m) => m.partition)).size).toBe(1);
      expect(reader.messages.map((m) => m.value)).toEqual(['step-1', 'step-2', 'step-3', 'step-4', 'step-5']);
    } finally {
      await reader.stop();
      await bus.deleteTopic(topic).catch(() => undefined);
    }
  });
});
