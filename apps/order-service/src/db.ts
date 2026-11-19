import pg from 'pg';
import { MongoClient, type Collection } from 'mongodb';
import { config } from './config';
import type { PlacedOrder } from './contract';

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 5 });
export const mongo = new MongoClient(config.mongoUrl);

export interface AuditEvent {
  orderId: string;
  event: 'received' | 'confirmed' | 'rejected';
  detail?: string;
  at: Date;
}
export const audit = (): Collection<AuditEvent> =>
  mongo.db(config.mongoDb).collection<AuditEvent>('order_audit');

/** Schema is created by the service at start-up; tests read it, they never create it. */
export async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      sku         TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      price_cents INTEGER NOT NULL CHECK (price_cents > 0),
      stock       INTEGER NOT NULL CHECK (stock >= 0)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id               UUID PRIMARY KEY,
      customer_id      UUID NOT NULL,
      status           TEXT NOT NULL CHECK (status IN ('confirmed', 'rejected')),
      total_cents      INTEGER NOT NULL CHECK (total_cents >= 0),
      currency         CHAR(3) NOT NULL,
      rejection_reason TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS order_lines (
      order_id         UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
      line_no          INTEGER NOT NULL,
      sku              TEXT NOT NULL,
      quantity         INTEGER NOT NULL CHECK (quantity > 0),
      unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents > 0),
      PRIMARY KEY (order_id, line_no)
    );
  `);
  // One audit event of each kind per order: a redelivered message cannot add a second one.
  await audit().createIndex({ orderId: 1, event: 1 }, { unique: true, name: 'order_event_unique' });
}

export type Outcome = { kind: 'confirmed' } | { kind: 'rejected'; reason: string } | { kind: 'duplicate' };

/**
 * Stores the order and reserves stock in one transaction. A duplicate message (same order id)
 * changes nothing. If any line cannot be reserved, no stock moves and the order is kept as rejected.
 */
export async function saveOrder(order: PlacedOrder): Promise<Outcome> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO orders (id, customer_id, status, total_cents, currency)
       VALUES ($1, $2, 'confirmed', $3, $4) ON CONFLICT (id) DO NOTHING RETURNING id`,
      [order.id, order.customerId, order.totalCents, order.currency],
    );
    if (inserted.rowCount === 0) {
      await client.query('ROLLBACK');
      return { kind: 'duplicate' };
    }
    for (const [i, line] of order.lines.entries()) {
      await client.query(
        'INSERT INTO order_lines (order_id, line_no, sku, quantity, unit_price_cents) VALUES ($1, $2, $3, $4, $5)',
        [order.id, i + 1, line.sku, line.quantity, line.unitPriceCents],
      );
    }

    await client.query('SAVEPOINT reserve');
    let reason: string | undefined;
    for (const line of order.lines) {
      const reserved = await client.query(
        'UPDATE products SET stock = stock - $2 WHERE sku = $1 AND stock >= $2 RETURNING stock',
        [line.sku, line.quantity],
      );
      if (reserved.rowCount === 0) {
        const known = await client.query('SELECT stock FROM products WHERE sku = $1', [line.sku]);
        reason =
          known.rowCount === 0
            ? `unknown sku ${line.sku}`
            : `insufficient stock for ${line.sku}: wanted ${line.quantity}, have ${known.rows[0].stock}`;
        break;
      }
    }
    if (reason) {
      await client.query('ROLLBACK TO SAVEPOINT reserve');
      await client.query(`UPDATE orders SET status = 'rejected', rejection_reason = $2 WHERE id = $1`, [
        order.id,
        reason,
      ]);
    }
    await client.query('COMMIT');
    return reason ? { kind: 'rejected', reason } : { kind: 'confirmed' };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Audit writes are idempotent: the unique index turns a redelivery into a no-op. */
export async function recordAudit(event: Omit<AuditEvent, 'at'>): Promise<void> {
  try {
    await audit().insertOne({ ...event, at: new Date() });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error; // 11000 = duplicate key
  }
}
