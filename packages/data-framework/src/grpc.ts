import path from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

/**
 * A client for the order service's gRPC API, built from the service's own proto file, so a change to
 * the contract shows up here as a failing test rather than a silent mismatch.
 */
export const ORDERS_PROTO = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'apps',
  'order-service',
  'proto',
  'orders.proto',
);

export interface OrderLine {
  sku: string;
  quantity: number;
  unitPriceCents: number;
}
export interface GrpcOrder {
  id: string;
  customerId: string;
  status: string;
  totalCents: number;
  currency: string;
  rejectionReason: string;
  lines: OrderLine[];
}
export interface OrderUpdate {
  orderId: string;
  status: string;
  rejectionReason: string;
}

export class OrdersClient {
  private readonly client: grpc.Client & Record<string, (...args: unknown[]) => unknown>;

  constructor(address: string) {
    const definition = protoLoader.loadSync(ORDERS_PROTO, {
      keepCase: false,
      longs: Number,
      enums: String,
      defaults: true,
    });
    const pkg = grpc.loadPackageDefinition(definition) as unknown as {
      aiqa: { orders: { v1: { Orders: grpc.ServiceClientConstructor } } };
    };
    this.client = new pkg.aiqa.orders.v1.Orders(
      address,
      grpc.credentials.createInsecure(),
    ) as typeof this.client;
  }

  private unary<T>(method: string, request: unknown, deadlineMs: number): Promise<T> {
    return new Promise((resolve, reject) =>
      this.client[method]!(
        request,
        { deadline: Date.now() + deadlineMs },
        (error: grpc.ServiceError | null, res: T) => (error ? reject(error) : resolve(res)),
      ),
    );
  }

  placeOrder(order: Omit<GrpcOrder, 'status' | 'rejectionReason'>, deadlineMs = 5000) {
    return this.unary<{ orderId: string }>('PlaceOrder', order, deadlineMs);
  }

  getOrder(id: string, deadlineMs = 5000) {
    return this.unary<GrpcOrder>('GetOrder', { id }, deadlineMs);
  }

  /** Every update until the stream ends; rejects with the gRPC error (DEADLINE_EXCEEDED, ...). */
  watchOrder(id: string, deadlineMs: number): Promise<OrderUpdate[]> {
    const updates: OrderUpdate[] = [];
    const stream = this.client.WatchOrder!(
      { id },
      { deadline: Date.now() + deadlineMs },
    ) as grpc.ClientReadableStream<OrderUpdate>;
    return new Promise((resolve, reject) => {
      stream.on('data', (u: OrderUpdate) => updates.push(u));
      stream.on('end', () => resolve(updates));
      stream.on('error', reject);
    });
  }

  close(): void {
    this.client.close();
  }
}

export { status as grpcStatus } from '@grpc/grpc-js';
