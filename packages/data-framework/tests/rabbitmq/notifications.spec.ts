import { anOrder, type Order } from '@aiqa/test-data-engine';
import { expect, freshProducts, test } from '../../src/fixtures';
import { NOTIFICATIONS } from '../../src/rabbit';
import { TOPICS } from '../../src/stack';

const placed = ({ id, customerId, currency, totalCents, lines }: Order) => ({
  id,
  customerId,
  currency,
  totalCents,
  lines,
});

test.describe('RabbitMQ: order notifications from the service', { tag: '@rabbitmq' }, () => {
  test('a confirmed order is announced once, persistent, with its id as the message id', async ({
    bus,
    rabbit,
    seed,
    stockProducts,
  }) => {
    const listener = await rabbit.listen(NOTIFICATIONS.exchange, 'order.*');
    const products = await stockProducts(freshProducts(seed, 2, { stock: 10 }));
    const order = anOrder(seed).from(products).build();

    await bus.publish(TOPICS.placed, order.id, placed(order));

    const mine = () => listener.messages.filter((m) => m.properties.messageId === order.id);
    await expect.poll(() => mine().length, { timeout: 20_000 }).toBe(1);
    const [message] = mine();
    expect(message).toMatchObject({
      exchange: NOTIFICATIONS.exchange,
      routingKey: NOTIFICATIONS.confirmed,
      json: { orderId: order.id, totalCents: order.totalCents },
    });
    expect(message!.properties).toMatchObject({
      deliveryMode: 2, // persistent: kept on disk by a durable queue
      contentType: 'application/json',
      appId: 'order-service',
    });
    // When it was published, for a consumer that must decide whether a notification is stale.
    expect(message!.properties.timestamp).toBeGreaterThan(Date.now() / 1000 - 60);
  });

  test('a rejected order goes out as order.rejected, and a queue bound to confirmations never sees it', async ({
    bus,
    rabbit,
    seed,
  }) => {
    const all = await rabbit.listen(NOTIFICATIONS.exchange, 'order.*');
    const confirmedOnly = await rabbit.listen(NOTIFICATIONS.exchange, NOTIFICATIONS.confirmed);
    const order = anOrder(seed)
      .withLines([{ sku: 'ZZZ-00000', quantity: 1, unitPriceCents: 500 }])
      .build();

    await bus.publish(TOPICS.placed, order.id, placed(order));

    await expect
      .poll(() =>
        all.messages.filter((m) => m.properties.messageId === order.id).map((m) => [m.routingKey, m.json]),
      )
      .toEqual([[NOTIFICATIONS.rejected, { orderId: order.id, reason: 'unknown sku ZZZ-00000' }]]);
    expect(confirmedOnly.messages.filter((m) => m.properties.messageId === order.id)).toEqual([]);
  });

  test('a message the service cannot read is announced as dead-lettered', async ({ bus, rabbit }) => {
    const listener = await rabbit.listen(NOTIFICATIONS.exchange, NOTIFICATIONS.deadLettered);
    const key = `bad-${Date.now()}`;
    await bus.publish(TOPICS.placed, key, '{"id": oops');
    await expect
      .poll(() => listener.messages.filter((m) => m.properties.messageId === key).map((m) => m.json))
      .toEqual([{ reason: 'not JSON', payload: '{"id": oops' }]);
  });
});

test.describe('RabbitMQ: delivery guarantees a consumer relies on', { tag: '@rabbitmq' }, () => {
  test('a message rejected without requeue lands in the dead-letter queue, with why', async ({ rabbit }) => {
    const dlx = await rabbit.exchange('dlx', 'fanout');
    const dead = await rabbit.queue('dead');
    await rabbit.ch.bindQueue(dead, dlx, '');
    const work = await rabbit.queue('work', { deadLetterExchange: dlx });

    rabbit.publish('', work, { job: 1 });
    await expect.poll(() => rabbit.depth(work)).toBe(1);
    const message = await rabbit.get(work);
    rabbit.ch.nack(message!.raw, false, false);

    await expect.poll(() => rabbit.depth(dead)).toBe(1);
    const deadLettered = await rabbit.get(dead);
    expect(deadLettered!.json).toEqual({ job: 1 });
    // RabbitMQ records the history in x-death: which queue, and why.
    expect(deadLettered!.properties.headers?.['x-death']?.[0]).toMatchObject({
      queue: work,
      reason: 'rejected',
    });
    rabbit.ch.ack(deadLettered!.raw);
  });

  test('a message nobody reads in time expires into the dead-letter queue', async ({ rabbit }) => {
    const dlx = await rabbit.exchange('dlx', 'fanout');
    const dead = await rabbit.queue('expired');
    await rabbit.ch.bindQueue(dead, dlx, '');
    const work = await rabbit.queue('ttl', { deadLetterExchange: dlx, messageTtl: 300 });

    rabbit.publish('', work, { job: 'late' });

    await expect.poll(() => rabbit.depth(dead), { timeout: 5_000 }).toBe(1);
    expect(await rabbit.depth(work)).toBe(0);
    const expired = await rabbit.get(dead);
    expect(expired!.properties.headers?.['x-death']?.[0]).toMatchObject({ reason: 'expired' });
    rabbit.ch.ack(expired!.raw);
  });

  test('a message not acknowledged before its consumer goes away is delivered again, marked redelivered', async ({
    rabbit,
  }) => {
    // At least once: a consumer that crashes mid-work gets the message back, so consumers must be
    // idempotent (the message id is there to drop a repeat).
    const work = await rabbit.queue('redeliver');
    rabbit.publish('', work, { job: 2 }, { messageId: 'job-2' });

    const first = await rabbit.newChannel();
    const seen = await first.get(work, { noAck: false });
    expect(seen && seen.fields.redelivered).toBe(false);
    await first.close(); // no ack: the broker puts it back

    await expect.poll(() => rabbit.depth(work)).toBe(1);
    const again = await rabbit.get(work);
    expect(again).toMatchObject({ redelivered: true, json: { job: 2 } });
    expect(again!.properties.messageId).toBe('job-2');
    rabbit.ch.ack(again!.raw);
  });

  test('a mandatory message no queue would take comes back to the publisher', async ({ rabbit }) => {
    const exchange = await rabbit.exchange('unroutable', 'direct');
    const returned = new Promise<string>((resolve) =>
      rabbit.ch.once('return', (m: { fields: { replyText: string } }) => resolve(m.fields.replyText)),
    );
    rabbit.publish(exchange, 'nobody.listens', { lost: true }, { mandatory: true });
    expect(await returned).toBe('NO_ROUTE');
  });

  test('prefetch 1 hands a busy consumer no second message until it acknowledges the first', async ({
    rabbit,
  }) => {
    const work = await rabbit.queue('prefetch');
    for (let i = 1; i <= 3; i++) rabbit.publish('', work, { job: i });
    await expect.poll(() => rabbit.depth(work)).toBe(3);

    const ch = await rabbit.newChannel();
    await ch.prefetch(1);
    const delivered: { job: number; ack: () => void }[] = [];
    await ch.consume(work, (m) => {
      if (m)
        delivered.push({
          job: (JSON.parse(m.content.toString()) as { job: number }).job,
          ack: () => ch.ack(m),
        });
    });

    await expect.poll(() => delivered.length).toBe(1);
    await new Promise((r) => setTimeout(r, 300));
    expect(delivered.map((d) => d.job)).toEqual([1]); // still one: the first is unacknowledged
    delivered[0]!.ack();
    await expect.poll(() => delivered.length).toBe(2);
    delivered[1]!.ack();
    await expect.poll(() => delivered.length).toBe(3);
    delivered[2]!.ack();
    await ch.close();
  });
});
