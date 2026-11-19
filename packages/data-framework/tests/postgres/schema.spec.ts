import type pg from 'pg';
import { aProduct } from '@aiqa/test-data-engine';
import { expect, test } from '../../src/fixtures';

/** Runs statements in a transaction that is always rolled back: the test leaves no rows behind. */
async function inRollback<T>(db: pg.Pool, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    return await work(client);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

/** The SQLSTATE a statement fails with, or 'ok'. 23514 = check, 23503 = foreign key, 23505 = unique. */
async function sqlState(client: pg.PoolClient, sql: string, params: unknown[]): Promise<string> {
  await client.query('SAVEPOINT attempt');
  try {
    await client.query(sql, params);
    await client.query('RELEASE SAVEPOINT attempt');
    return 'ok';
  } catch (error) {
    await client.query('ROLLBACK TO SAVEPOINT attempt');
    return (error as { code?: string }).code ?? 'unknown';
  }
}

test.describe('Postgres: schema and constraints', { tag: '@postgres' }, () => {
  test('the order tables have the columns the service and reports rely on', async ({ db }) => {
    const { rows } = await db.query<{ table_name: string; column_name: string; data_type: string }>(
      `SELECT table_name, column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name IN ('products', 'orders', 'order_lines')`,
    );
    const columns = (table: string) =>
      rows
        .filter((r) => r.table_name === table)
        .map((r) => r.column_name)
        .sort();
    expect(columns('products')).toEqual(['name', 'price_cents', 'sku', 'stock']);
    expect(columns('orders')).toEqual(
      ['created_at', 'currency', 'customer_id', 'id', 'rejection_reason', 'status', 'total_cents'].sort(),
    );
    expect(columns('order_lines')).toEqual(['line_no', 'order_id', 'quantity', 'sku', 'unit_price_cents']);
    expect(rows.find((r) => r.table_name === 'orders' && r.column_name === 'id')?.data_type).toBe('uuid');
  });

  test('stock can never go below zero', async ({ db, seed }) => {
    const p = aProduct(seed).build();
    const state = await inRollback(db, (c) =>
      sqlState(c, 'INSERT INTO products (sku, name, price_cents, stock) VALUES ($1, $2, $3, -1)', [
        p.sku,
        p.name,
        p.priceCents,
      ]),
    );
    expect(state).toBe('23514');
  });

  test('a product price must be above zero', async ({ db, seed }) => {
    const p = aProduct(seed).build();
    const state = await inRollback(db, (c) =>
      sqlState(c, 'INSERT INTO products (sku, name, price_cents, stock) VALUES ($1, $2, 0, 1)', [
        p.sku,
        p.name,
      ]),
    );
    expect(state).toBe('23514');
  });

  test('an order status outside confirmed or rejected is refused', async ({ db }) => {
    const state = await inRollback(db, (c) =>
      sqlState(
        c,
        `INSERT INTO orders (id, customer_id, status, total_cents, currency) VALUES (gen_random_uuid(), gen_random_uuid(), 'lost', 0, 'USD')`,
        [],
      ),
    );
    expect(state).toBe('23514');
  });

  test('an order line needs an existing order', async ({ db }) => {
    const state = await inRollback(db, (c) =>
      sqlState(
        c,
        `INSERT INTO order_lines (order_id, line_no, sku, quantity, unit_price_cents) VALUES (gen_random_uuid(), 1, 'ABC-00001', 1, 100)`,
        [],
      ),
    );
    expect(state).toBe('23503');
  });

  test('deleting an order removes its lines with it', async ({ db }) => {
    const remaining = await inRollback(db, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `INSERT INTO orders (id, customer_id, status, total_cents, currency) VALUES (gen_random_uuid(), gen_random_uuid(), 'confirmed', 100, 'USD') RETURNING id`,
      );
      const id = rows[0]!.id;
      await c.query(`INSERT INTO order_lines VALUES ($1, 1, 'ABC-00001', 1, 100)`, [id]);
      await c.query('DELETE FROM orders WHERE id = $1', [id]);
      return (await c.query('SELECT count(*)::int AS n FROM order_lines WHERE order_id = $1', [id])).rows[0]
        .n;
    });
    expect(remaining).toBe(0);
  });
});

test.describe('Postgres: data quality across every stored order', { tag: '@postgres' }, () => {
  // Data checks run over the whole table, not one test's rows: they catch a bug in any code path.
  test('every confirmed order total equals the sum of its lines', async ({ db }) => {
    const { rows } = await db.query(`
      SELECT o.id, o.total_cents, coalesce(sum(l.quantity * l.unit_price_cents), 0) AS lines_total
      FROM orders o LEFT JOIN order_lines l ON l.order_id = o.id
      GROUP BY o.id HAVING o.total_cents <> coalesce(sum(l.quantity * l.unit_price_cents), 0)`);
    expect(rows, 'orders whose total does not match their lines').toEqual([]);
  });

  test('every order has at least one line', async ({ db }) => {
    const { rows } = await db.query(
      'SELECT o.id FROM orders o WHERE NOT EXISTS (SELECT 1 FROM order_lines l WHERE l.order_id = o.id)',
    );
    expect(rows, 'orders without lines').toEqual([]);
  });

  test('only rejected orders carry a rejection reason, and every rejected order has one', async ({ db }) => {
    const { rows } = await db.query(
      `SELECT id, status FROM orders WHERE (status = 'rejected') <> (rejection_reason IS NOT NULL)`,
    );
    expect(rows).toEqual([]);
  });
});
