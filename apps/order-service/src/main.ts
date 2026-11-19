import http from 'node:http';
import {
  Admin,
  Consumer,
  Producer,
  stringDeserializers,
  stringSerializers,
  type Message,
  type MessagesStream,
} from '@platformatic/kafka';
import { config, TOPICS } from './config';
import { placedOrder, productUpsert } from './contract';
import { migrate, mongo, pool, recordAudit, saveOrder } from './db';
import { ordersProcessed, processingSeconds, shutdownMetrics } from './metrics';
import { PartitionWorkers } from './partitions';

const kafka = { clientId: 'order-service', bootstrapBrokers: config.kafkaBrokers };
const producer = new Producer({ ...kafka, idempotent: true, serializers: stringSerializers });
const consumer = new Consumer({ ...kafka, groupId: 'order-service', deserializers: stringDeserializers });
let ready = false;

const log = (message: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ at: new Date().toISOString(), message, ...extra }));

const publish = (topic: string, key: string, value: unknown) =>
  producer.send({ messages: [{ topic, key, value: JSON.stringify(value) }] });

/** One message from orders.placed, start to finish. */
async function handle(raw: string | undefined, key: string | undefined): Promise<void> {
  const started = performance.now();
  let json: unknown;
  try {
    json = JSON.parse(raw ?? '');
  } catch {
    json = undefined;
  }
  const parsed = placedOrder.safeParse(json);
  if (!parsed.success) {
    const reason = json === undefined ? 'not JSON' : parsed.error.issues.map((i) => i.message).join('; ');
    await publish(TOPICS.deadLetter, key ?? 'unknown', { reason, payload: raw ?? null });
    ordersProcessed.add(1, { outcome: 'invalid' });
    log('order rejected to DLQ', { key, reason });
    return;
  }
  const order = parsed.data;
  await recordAudit({ orderId: order.id, event: 'received' });
  const outcome = await saveOrder(order);
  ordersProcessed.add(1, { outcome: outcome.kind });
  if (outcome.kind === 'duplicate') {
    log('duplicate order ignored', { orderId: order.id });
    return;
  }
  if (outcome.kind === 'confirmed') {
    await recordAudit({ orderId: order.id, event: 'confirmed' });
    await publish(TOPICS.confirmed, order.id, { orderId: order.id, totalCents: order.totalCents });
  } else {
    await recordAudit({ orderId: order.id, event: 'rejected', detail: outcome.reason });
    await publish(TOPICS.rejected, order.id, { orderId: order.id, reason: outcome.reason });
  }
  processingSeconds.record((performance.now() - started) / 1000, { outcome: outcome.kind });
  log(`order ${outcome.kind}`, { orderId: order.id });
}

const json = (res: http.ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
};

const MAX_BODY_BYTES = 64 * 1024;

/** Reads a JSON body. Returns undefined for a body that is not JSON; rejects one that is too large. */
async function readJson(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('request body too large'), { status: 413 });
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return undefined;
  }
}

const issues = (error: { issues: { message: string }[] }) => error.issues.map((i) => i.message).join('; ');

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/health') return json(res, ready ? 200 : 503, { ready });

    // HTTP front door for orders (used by the load tests): checked against the same contract as the
    // Kafka path, then published to orders.placed. 202: accepted, the outcome follows asynchronously
    // (GET /orders/:id, or orders.confirmed / orders.rejected). An invalid order is refused here
    // with 400 instead of travelling to the dead-letter topic.
    if (req.method === 'POST' && req.url === '/orders') {
      if (!ready) return json(res, 503, { error: 'not ready' });
      const parsed = placedOrder.safeParse(await readJson(req));
      if (!parsed.success) return json(res, 400, { error: issues(parsed.error) });
      await publish(TOPICS.placed, parsed.data.id, parsed.data);
      return json(res, 202, { orderId: parsed.data.id, status: 'accepted' });
    }

    // Catalogue upkeep: create a product or replace its name, price and stock. A demo service with no
    // authentication; a real one would put this behind an admin role.
    const product = /^\/products\/([A-Za-z0-9._-]{1,64})$/.exec(req.url ?? '');
    if (req.method === 'PUT' && product) {
      const parsed = productUpsert.safeParse(await readJson(req));
      if (!parsed.success) return json(res, 400, { error: issues(parsed.error) });
      const { name, priceCents, stock } = parsed.data;
      const saved = await pool.query(
        `INSERT INTO products (sku, name, price_cents, stock) VALUES ($1, $2, $3, $4)
         ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name, price_cents = EXCLUDED.price_cents, stock = EXCLUDED.stock
         RETURNING (xmax = 0) AS created`,
        [product[1], name, priceCents, stock],
      );
      return json(res, saved.rows[0].created ? 201 : 200, { sku: product[1], name, priceCents, stock });
    }

    const match = /^\/orders\/([0-9a-f-]{36})$/i.exec(req.url ?? '');
    if (req.method === 'GET' && match) {
      const order = await pool.query(
        'SELECT id, customer_id, status, total_cents, currency, rejection_reason FROM orders WHERE id = $1',
        [match[1]],
      );
      if (order.rowCount === 0) return json(res, 404, { error: 'order not found' });
      const lines = await pool.query(
        'SELECT sku, quantity, unit_price_cents FROM order_lines WHERE order_id = $1 ORDER BY line_no',
        [match[1]],
      );
      const o = order.rows[0];
      return json(res, 200, {
        id: o.id,
        customerId: o.customer_id,
        status: o.status,
        totalCents: o.total_cents,
        currency: o.currency.trim(),
        rejectionReason: o.rejection_reason,
        lines: lines.rows.map((l) => ({
          sku: l.sku,
          quantity: l.quantity,
          unitPriceCents: l.unit_price_cents,
        })),
      });
    }
    return json(res, 404, { error: 'not found' });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return json(res, status, { error: (error as Error).message });
  }
});

async function start(): Promise<void> {
  await mongo.connect();
  await migrate();
  // Create only the topics that are missing: creating an existing topic is an error.
  const admin = new Admin(kafka);
  const existing = new Set(await admin.listTopics());
  const missing = Object.values(TOPICS).filter((topic) => !existing.has(topic));
  if (missing.length > 0) await admin.createTopics({ topics: missing, partitions: 3, replicas: 1 });
  await admin.close();
  // A new group starts from the earliest offset; after that it resumes from its committed offset.
  // Offsets are committed by hand, after an order is handled: committing on read (autocommit) could
  // skip orders that were read but not yet handled when the service stopped.
  stream = await consumer.consume({
    topics: [TOPICS.placed],
    mode: 'committed',
    fallbackMode: 'earliest',
    autocommit: false,
  });
  void (async () => {
    for await (const message of stream!) await workers.push(message);
  })().catch((error: unknown) => {
    log('consumer stopped', { error: (error as Error).message });
    process.exit(1);
  });
  ready = true;
  log('order service ready', {
    port: config.port,
    metricsPort: config.metricsPort,
    parallelPartitions: config.parallelPartitions,
  });
}

type PlacedMessage = Message<string, string, string, string>;
let stream: MessagesStream<string, string, string, string> | undefined;

/**
 * Commits at most once a second per partition, after the message is handled: a commit is a round
 * trip to Kafka, and committing an offset also covers every earlier one in that partition. The last
 * handled message of each partition is committed again on shutdown. At-least-once: after a crash up
 * to a second of orders is handled again, which saveOrder's duplicate check makes harmless.
 */
const lastHandled = new Map<number, PlacedMessage>();
const lastCommitAt = new Map<number, number>();
const commitHandled = async () => {
  await Promise.allSettled([...lastHandled.values()].map((message) => message.commit()));
};

const workers = new PartitionWorkers<PlacedMessage>(
  async (message) => {
    await handle(message.value ?? undefined, message.key || undefined);
    lastHandled.set(message.partition, message);
    if (Date.now() - (lastCommitAt.get(message.partition) ?? 0) >= 1000) {
      lastCommitAt.set(message.partition, Date.now());
      await message.commit();
    }
  },
  {
    queueOf: config.parallelPartitions ? undefined : () => 0,
    onError: (error, message) => {
      log('order handling failed; stopping', {
        error: (error as Error).message,
        partition: message.partition,
        offset: String(message.offset),
      });
      process.exit(1);
    },
  },
);

server.listen(config.port);
start().catch((error: unknown) => {
  log('start-up failed', { error: (error as Error).message });
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    ready = false;
    // Stop reading, finish what is queued, commit it, then let go of the group.
    await stream?.close().catch(() => undefined);
    await workers.drain();
    await commitHandled();
    await consumer.close(true).catch(() => undefined);
    await producer.close().catch(() => undefined);
    await Promise.allSettled([pool.end(), mongo.close(), shutdownMetrics()]);
    server.close(() => process.exit(0));
  });
}
