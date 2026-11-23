import { randomUUID } from 'node:crypto';
import { anOrder, type Order } from '@aiqa/test-data-engine';
import { expect, freshProducts, test } from '../../src/fixtures';
import { grpcStatus } from '../../src/grpc';

const request = ({ id, customerId, currency, totalCents, lines }: Order) => ({
  id,
  customerId,
  currency,
  totalCents,
  lines,
});

test.describe('gRPC: the order API', { tag: '@grpc' }, () => {
  test('an order placed over gRPC is processed and reads back the same over gRPC and HTTP', async ({
    orders,
    service,
    seed,
    stockProducts,
  }) => {
    const products = await stockProducts(freshProducts(seed, 2, { stock: 10 }));
    const order = anOrder(seed).from(products).build();

    expect(await orders.placeOrder(request(order))).toEqual({ orderId: order.id });

    await expect
      .poll(() =>
        orders.getOrder(order.id).then(
          (o) => o.status,
          () => 'missing',
        ),
      )
      .toBe('ORDER_STATUS_CONFIRMED');
    const viaGrpc = await orders.getOrder(order.id);
    expect(viaGrpc).toEqual({ ...request(order), status: 'ORDER_STATUS_CONFIRMED', rejectionReason: '' });
    // One order, two front doors: they must agree.
    const viaHttp = await (await service.get(`/orders/${order.id}`)).json();
    expect(viaHttp).toMatchObject({
      id: order.id,
      status: 'confirmed',
      totalCents: viaGrpc.totalCents,
      lines: viaGrpc.lines,
    });
  });

  test('WatchOrder streams PENDING, then the decision, then ends', async ({ orders, seed }) => {
    const order = anOrder(seed)
      .withLines([{ sku: 'ZZZ-00000', quantity: 1, unitPriceCents: 500 }])
      .build();
    const watching = orders.watchOrder(order.id, 20_000);
    await orders.placeOrder(request(order));

    const updates = await watching;
    expect(updates.at(0)?.status).toBe('ORDER_STATUS_PENDING');
    expect(updates.at(-1)).toEqual({
      orderId: order.id,
      status: 'ORDER_STATUS_REJECTED',
      rejectionReason: 'unknown sku ZZZ-00000',
    });
  });

  test('an order that breaks the contract is refused with INVALID_ARGUMENT, naming the problem', async ({
    orders,
    seed,
  }) => {
    const order = anOrder(seed).build();
    await expect(
      orders.placeOrder({ ...request(order), totalCents: order.totalCents + 1 }),
    ).rejects.toMatchObject({
      code: grpcStatus.INVALID_ARGUMENT,
      details: expect.stringContaining('totalCents does not match the lines'),
    });
    await expect(orders.placeOrder({ ...request(order), currency: 'EUR' })).rejects.toMatchObject({
      code: grpcStatus.INVALID_ARGUMENT,
      details: expect.stringContaining('currency'),
    });
    // Refused at the door: it never reached Kafka, so there is nothing to read.
    await expect(orders.getOrder(order.id)).rejects.toMatchObject({ code: grpcStatus.NOT_FOUND });
  });

  test('status codes: NOT_FOUND for an unknown order, INVALID_ARGUMENT for an id that is not a UUID', async ({
    orders,
  }) => {
    await expect(orders.getOrder(randomUUID())).rejects.toMatchObject({ code: grpcStatus.NOT_FOUND });
    await expect(orders.getOrder('42')).rejects.toMatchObject({ code: grpcStatus.INVALID_ARGUMENT });
  });

  test('a watch on an order that never comes ends at the client deadline', async ({ orders }) => {
    const started = Date.now();
    await expect(orders.watchOrder(randomUUID(), 1_000)).rejects.toMatchObject({
      code: grpcStatus.DEADLINE_EXCEEDED,
    });
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});
