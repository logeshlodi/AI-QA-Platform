import path from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { z } from 'zod';
import type { OrderView } from './api';
import { placedOrder, type PlacedOrder } from './contract';

/**
 * The gRPC front door (proto/orders.proto), next to the HTTP one and checked against the same
 * contract. It does no work of its own: placing an order publishes it to orders.placed, and reading
 * one reads what the Kafka consumer stored, exactly like the HTTP API.
 */
export const PROTO_FILE = path.join(__dirname, '..', 'proto', 'orders.proto');

export interface GrpcDeps {
  isReady(): boolean;
  place(order: PlacedOrder): Promise<void>;
  read(id: string): Promise<OrderView | undefined>;
  log(message: string, extra?: Record<string, unknown>): void;
  /** How often WatchOrder looks for a decision. */
  pollMs?: number;
}

type Line = { sku: string; quantity: number; unitPriceCents: number };
type PlaceRequest = { id: string; customerId: string; currency: string; totalCents: number; lines: Line[] };
type Status = 'ORDER_STATUS_PENDING' | 'ORDER_STATUS_CONFIRMED' | 'ORDER_STATUS_REJECTED';

const statusOf = (view: OrderView | undefined): Status =>
  !view
    ? 'ORDER_STATUS_PENDING'
    : view.status === 'confirmed'
      ? 'ORDER_STATUS_CONFIRMED'
      : 'ORDER_STATUS_REJECTED';

const uuid = z.uuid();
const fail = (code: grpc.status, details: string) => Object.assign(new Error(details), { code, details });

export function loadOrdersService(): grpc.ServiceDefinition {
  const definition = protoLoader.loadSync(PROTO_FILE, {
    keepCase: false,
    longs: Number,
    enums: String,
    defaults: true,
  });
  const pkg = grpc.loadPackageDefinition(definition) as unknown as {
    aiqa: { orders: { v1: { Orders: { service: grpc.ServiceDefinition } } } };
  };
  return pkg.aiqa.orders.v1.Orders.service;
}

export function ordersHandlers(deps: GrpcDeps): grpc.UntypedServiceImplementation {
  const pollMs = deps.pollMs ?? 200;
  // Unexpected errors are logged and answered with INTERNAL, telling the caller nothing more.
  const guard =
    <Req, Res>(name: string, fn: (req: Req) => Promise<Res>) =>
    (call: grpc.ServerUnaryCall<Req, Res>, callback: grpc.sendUnaryData<Res>) => {
      fn(call.request).then(
        (res) => callback(null, res),
        (error: { code?: grpc.status; details?: string; message: string }) => {
          if (error.code === undefined) deps.log('grpc call failed', { method: name, error: error.message });
          callback({
            code: error.code ?? grpc.status.INTERNAL,
            details: error.code === undefined ? 'internal error' : error.details,
          });
        },
      );
    };

  return {
    PlaceOrder: guard('PlaceOrder', async (req: PlaceRequest) => {
      if (!deps.isReady()) throw fail(grpc.status.UNAVAILABLE, 'not ready');
      const parsed = placedOrder.safeParse(req);
      if (!parsed.success) {
        throw fail(
          grpc.status.INVALID_ARGUMENT,
          parsed.error.issues.map((i) => `${i.path.join('.') || 'order'}: ${i.message}`).join('; '),
        );
      }
      await deps.place(parsed.data);
      return { orderId: parsed.data.id };
    }),

    GetOrder: guard('GetOrder', async (req: { id: string }) => {
      if (!uuid.safeParse(req.id).success) throw fail(grpc.status.INVALID_ARGUMENT, 'id must be a UUID');
      const view = await deps.read(req.id);
      if (!view) throw fail(grpc.status.NOT_FOUND, 'order not found');
      return { ...view, status: statusOf(view), rejectionReason: view.rejectionReason ?? '' };
    }),

    WatchOrder: (call: grpc.ServerWritableStream<{ id: string }, unknown>) => {
      const { id } = call.request;
      if (!uuid.safeParse(id).success) {
        call.destroy(fail(grpc.status.INVALID_ARGUMENT, 'id must be a UUID'));
        return;
      }
      let last: Status | undefined;
      let stopped = false;
      call.on('cancelled', () => (stopped = true)); // the client gave up, or its deadline passed
      void (async () => {
        while (!stopped) {
          const view = await deps.read(id);
          const status = statusOf(view);
          if (status !== last) {
            call.write({ orderId: id, status, rejectionReason: view?.rejectionReason ?? '' });
            last = status;
          }
          if (status !== 'ORDER_STATUS_PENDING') return call.end();
          await new Promise((resolve) => setTimeout(resolve, pollMs));
        }
      })().catch((error: Error) => {
        deps.log('grpc call failed', { method: 'WatchOrder', error: error.message });
        call.destroy(fail(grpc.status.INTERNAL, 'internal error'));
      });
    },
  };
}

/** Starts the gRPC server; resolves with a function that stops it. */
export async function startGrpc(port: number, deps: GrpcDeps): Promise<() => Promise<void>> {
  const server = new grpc.Server();
  server.addService(loadOrdersService(), ordersHandlers(deps));
  await new Promise<number>((resolve, reject) =>
    server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (error, bound) =>
      error ? reject(error) : resolve(bound),
    ),
  );
  return () => new Promise<void>((resolve) => server.tryShutdown(() => resolve()));
}
