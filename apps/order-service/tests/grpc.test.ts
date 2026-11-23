import * as grpc from '@grpc/grpc-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { OrderView } from '../src/api';
import type { PlacedOrder } from '../src/contract';
import { loadOrdersService, startGrpc } from '../src/grpc';

// The gRPC handlers on a real server and client, with the database and Kafka replaced by a map.
const ID = '8a3b8f0e-6a1e-4c1f-9a43-3f8f4d3c2b10';
const CUSTOMER = '0b6c7f53-2c8a-4f4c-8d5e-9d5c1c2b3a40';
const stored = new Map<string, OrderView>();
const placed: PlacedOrder[] = [];
let ready = true;
let stop: () => Promise<void>;
let client: grpc.Client & Record<string, (...args: unknown[]) => unknown>;

const call = <T>(method: string, request: unknown, deadlineMs = 2000) =>
  new Promise<T>((resolve, reject) =>
    client[method]!(
      request,
      { deadline: Date.now() + deadlineMs },
      (error: grpc.ServiceError | null, res: T) => (error ? reject(error) : resolve(res)),
    ),
  );

beforeAll(async () => {
  const port = 50000 + Math.floor(Math.random() * 1000);
  stop = await startGrpc(port, {
    isReady: () => ready,
    place: async (order) => void placed.push(order),
    read: async (id) => stored.get(id),
    log: () => undefined,
    pollMs: 20,
  });
  const Client = grpc.makeGenericClientConstructor(loadOrdersService(), 'Orders');
  client = new Client(`127.0.0.1:${port}`, grpc.credentials.createInsecure()) as typeof client;
});
afterAll(async () => {
  client.close();
  await stop();
});

const order = {
  id: ID,
  customerId: CUSTOMER,
  currency: 'USD',
  totalCents: 1000,
  lines: [{ sku: 'SKU-1', quantity: 2, unitPriceCents: 500 }],
};

describe('PlaceOrder', () => {
  it('accepts an order that meets the contract and hands it on', async () => {
    await expect(call('PlaceOrder', order)).resolves.toEqual({ orderId: ID });
    expect(placed.at(-1)).toEqual(order);
  });

  it('refuses one that does not, with the field named', async () => {
    await expect(call('PlaceOrder', { ...order, totalCents: 999 })).rejects.toMatchObject({
      code: grpc.status.INVALID_ARGUMENT,
      details: expect.stringContaining('totalCents does not match the lines'),
    });
  });

  it('is UNAVAILABLE before the service is ready', async () => {
    ready = false;
    await expect(call('PlaceOrder', order)).rejects.toMatchObject({ code: grpc.status.UNAVAILABLE });
    ready = true;
  });
});

describe('GetOrder and WatchOrder', () => {
  it('answers NOT_FOUND, INVALID_ARGUMENT, or the order', async () => {
    await expect(call('GetOrder', { id: ID })).rejects.toMatchObject({ code: grpc.status.NOT_FOUND });
    await expect(call('GetOrder', { id: 'nope' })).rejects.toMatchObject({
      code: grpc.status.INVALID_ARGUMENT,
    });
    stored.set(ID, { ...order, currency: 'USD', status: 'confirmed', rejectionReason: null });
    await expect(call('GetOrder', { id: ID })).resolves.toMatchObject({
      id: ID,
      status: 'ORDER_STATUS_CONFIRMED',
      rejectionReason: '',
      lines: order.lines,
    });
    stored.delete(ID);
  });

  it('streams PENDING, then the decision, then ends', async () => {
    const updates: unknown[] = [];
    const stream = client.WatchOrder!(
      { id: ID },
      { deadline: Date.now() + 3000 },
    ) as grpc.ClientReadableStream<{
      status: string;
    }>;
    stream.on('data', (u) => {
      updates.push(u.status);
      if (u.status === 'ORDER_STATUS_PENDING')
        setTimeout(
          () =>
            stored.set(ID, { ...order, currency: 'USD', status: 'rejected', rejectionReason: 'no stock' }),
          50,
        );
    });
    await new Promise((resolve, reject) => stream.on('end', resolve).on('error', reject));
    expect(updates).toEqual(['ORDER_STATUS_PENDING', 'ORDER_STATUS_REJECTED']);
    stored.delete(ID);
  });

  it('stops at the client deadline when nothing is decided', async () => {
    const stream = client.WatchOrder!(
      { id: ID },
      { deadline: Date.now() + 300 },
    ) as grpc.ClientReadableStream<unknown>;
    stream.on('data', () => undefined);
    await expect(
      new Promise((resolve, reject) => stream.on('end', resolve).on('error', reject)),
    ).rejects.toMatchObject({
      code: grpc.status.DEADLINE_EXCEEDED,
    });
  });
});
