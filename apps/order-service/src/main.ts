import http from 'node:http';
import { Kafka, logLevel, type Producer } from 'kafkajs';
import { config, TOPICS } from './config';
import { placedOrder } from './contract';
import { migrate, mongo, pool, recordAudit, saveOrder } from './db';
import { ordersProcessed, processingSeconds, shutdownMetrics } from './metrics';

const kafka = new Kafka({ clientId: 'order-service', brokers: config.kafkaBrokers, logLevel: logLevel.WARN });
const producer: Producer = kafka.producer({ idempotent: true });
const consumer = kafka.consumer({ groupId: 'order-service' });
let ready = false;

const log = (message: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ at: new Date().toISOString(), message, ...extra }));

const publish = (topic: string, key: string, value: unknown) =>
  producer.send({ topic, messages: [{ key, value: JSON.stringify(value) }] });

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
  const admin = kafka.admin();
  await admin.connect();
  await admin.createTopics({
    topics: Object.values(TOPICS).map((topic) => ({ topic, numPartitions: 3, replicationFactor: 1 })),
  });
  await admin.disconnect();
  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.placed, fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ message }) => handle(message.value?.toString(), message.key?.toString()),
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
    await consumer.disconnect().catch(() => undefined);
    await producer.disconnect().catch(() => undefined);
    await Promise.allSettled([pool.end(), mongo.close(), shutdownMetrics()]);
    server.close(() => process.exit(0));
  });
}
