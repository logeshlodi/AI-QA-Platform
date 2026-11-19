import { randomUUID } from 'node:crypto';
import { expect, test } from '../../src/fixtures';
import { TOPICS } from '../../src/stack';

test.describe('Kafka: topics and delivery guarantees', { tag: '@kafka' }, () => {
  test('the service topics exist with three partitions each', async ({ bus }) => {
    const admin = bus.client.admin();
    await admin.connect();
    try {
      const { topics } = await admin.fetchTopicMetadata({ topics: Object.values(TOPICS) });
      expect(Object.fromEntries(topics.map((t) => [t.name, t.partitions.length]))).toEqual(
        Object.fromEntries(Object.values(TOPICS).map((t) => [t, 3])),
      );
    } finally {
      await admin.disconnect();
    }
  });

  test('messages with the same key stay in one partition, in the order sent', async ({ bus }) => {
    // Kafka only orders messages within a partition; the key decides the partition.
    // That is why the service keys every order event by order id.
    const topic = `aiqa.test.ordering.${randomUUID()}`;
    const key = randomUUID();
    const admin = bus.client.admin();
    await admin.connect();
    await admin.createTopics({ topics: [{ topic, numPartitions: 3 }], waitForLeaders: true });
    const consumer = bus.client.consumer({ groupId: `aiqa-ordering-${randomUUID()}` });
    try {
      const received: { partition: number; value: string }[] = [];
      await consumer.connect();
      await consumer.subscribe({ topic, fromBeginning: true });
      await consumer.run({
        eachMessage: async ({ partition, message }) => {
          received.push({ partition, value: message.value!.toString() });
        },
      });
      for (let i = 1; i <= 5; i++) await bus.publish(topic, key, `step-${i}`);
      await expect.poll(() => received.length).toBe(5);
      expect(new Set(received.map((r) => r.partition)).size).toBe(1);
      expect(received.map((r) => r.value)).toEqual(['step-1', 'step-2', 'step-3', 'step-4', 'step-5']);
    } finally {
      await consumer.disconnect();
      await admin.deleteTopics({ topics: [topic] }).catch(() => undefined);
      await admin.disconnect();
    }
  });
});
