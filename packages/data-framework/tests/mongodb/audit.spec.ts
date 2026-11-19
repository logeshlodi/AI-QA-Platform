import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { expect, test } from '../../src/fixtures';

const auditEvent = z.object({
  orderId: z.uuid(),
  event: z.enum(['received', 'confirmed', 'rejected']),
  detail: z.string().optional(),
  at: z.date(),
});

test.describe('MongoDB: order audit trail', { tag: '@mongodb' }, () => {
  test('a unique index allows one event of each kind per order', async ({ mongo }) => {
    const indexes = await mongo.collection('order_audit').indexes();
    expect(indexes.find((i) => i.name === 'order_event_unique')).toMatchObject({
      key: { orderId: 1, event: 1 },
      unique: true,
    });
  });

  test('a second identical event is refused with a duplicate-key error', async ({ mongo }) => {
    const audit = mongo.collection('order_audit');
    const orderId = randomUUID();
    try {
      await audit.insertOne({ orderId, event: 'received', at: new Date() });
      await expect(audit.insertOne({ orderId, event: 'received', at: new Date() })).rejects.toMatchObject({
        code: 11000,
      });
      await audit.insertOne({ orderId, event: 'confirmed', at: new Date() }); // a different event is fine
      expect(await audit.countDocuments({ orderId })).toBe(2);
    } finally {
      await audit.deleteMany({ orderId });
    }
  });

  test('every stored audit event has the documented shape', async ({ mongo }) => {
    // MongoDB has no fixed schema, so the contract is checked from the data side.
    const docs = await mongo
      .collection('order_audit')
      .find({}, { projection: { _id: 0 } })
      .limit(500)
      .toArray();
    const bad = docs.flatMap((d) => {
      const parsed = auditEvent.safeParse(d);
      return parsed.success ? [] : [{ doc: d, issues: parsed.error.issues.map((i) => i.message) }];
    });
    expect(bad).toEqual([]);
  });
});
