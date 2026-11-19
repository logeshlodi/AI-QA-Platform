import http from 'node:http';
import { Admin, Consumer, Producer, stringDeserializers, stringSerializers } from '@platformatic/kafka';
import { config, TOPICS } from './config';
import { placedOrder } from './contract';
import { migrate, mongo, pool, recordAudit, saveOrder } from './db';
import { ordersProcessed, processingSeconds, shutdownMetrics } from './metrics';

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

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/health') return json(res, ready ? 200 : 503, { ready });
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
    return json(res, 500, { error: (error as Error).message });
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
  const stream = await consumer.consume({
    topics: [TOPICS.placed],
    mode: 'committed',
    fallbackMode: 'earliest',
    autocommit: true,
  });
  // One message at a time, in order, as kafkajs's eachMessage did.
  void (async () => {
    for await (const message of stream) await handle(message.value ?? undefined, message.key || undefined);
  })().catch((error: unknown) => {
    log('consumer stopped', { error: (error as Error).message });
    process.exit(1);
  });
  ready = true;
  log('order service ready', { port: config.port, metricsPort: config.metricsPort });
}

server.listen(config.port);
start().catch((error: unknown) => {
  log('start-up failed', { error: (error as Error).message });
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    ready = false;
    await consumer.close(true).catch(() => undefined);
    await producer.close().catch(() => undefined);
    await Promise.allSettled([pool.end(), mongo.close(), shutdownMetrics()]);
    server.close(() => process.exit(0));
  });
}
