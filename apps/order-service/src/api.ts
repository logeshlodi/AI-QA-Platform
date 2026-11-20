import { z } from 'zod';
import { placedOrder, productUpsert } from './contract';

/**
 * The HTTP API's response shapes and its OpenAPI document. The document is built from the same zod
 * schemas that check requests, so it cannot drift from what the service accepts. The data suite
 * fetches it from GET /openapi.json and checks real responses against it.
 */
export const orderView = z.object({
  id: z.uuid(),
  customerId: z.uuid(),
  status: z.enum(['confirmed', 'rejected']),
  totalCents: z.number().int().nonnegative(),
  currency: z.literal('USD'),
  rejectionReason: z.string().nullable(),
  lines: z
    .array(
      z.object({
        sku: z.string().min(1),
        quantity: z.number().int().min(1),
        unitPriceCents: z.number().int().min(1),
      }),
    )
    .min(1),
});

export const orderAccepted = z.object({ orderId: z.uuid(), status: z.literal('accepted') });
export const productView = productUpsert.extend({ sku: z.string().min(1) });
export const apiError = z.object({ error: z.string().min(1) });
export const health = z.object({ ready: z.boolean() });

export type OrderView = z.infer<typeof orderView>;
export type OrderAccepted = z.infer<typeof orderAccepted>;
export type ProductView = z.infer<typeof productView>;

export const SKU_PATTERN = '^[A-Za-z0-9._-]{1,64}$';

type Io = 'input' | 'output';
/** zod to JSON Schema 2020-12, which is what OpenAPI 3.1 uses; the top-level $schema key is dropped. */
function schema(type: z.ZodType, io: Io = 'output'): Record<string, unknown> {
  const generated = z.toJSONSchema(type, { io, unrepresentable: 'any' }) as Record<string, unknown>;
  delete generated.$schema;
  return generated;
}

const json = (type: z.ZodType, description: string, io: Io = 'output') => ({
  description,
  content: { 'application/json': { schema: schema(type, io) } },
});

const error = (description: string) => json(apiError, description);

export function openApiDocument(serverUrl?: string) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Order service',
      version: '1.0.0',
      description:
        'The system under test for the data and messaging suites. Orders placed here go through Kafka; ' +
        'their outcome is read back with GET /orders/{id}.',
    },
    ...(serverUrl ? { servers: [{ url: serverUrl }] } : {}),
    paths: {
      '/health': {
        get: {
          operationId: 'health',
          summary: 'Whether the service is connected and ready',
          responses: { '200': json(health, 'Ready'), '503': json(health, 'Not ready yet') },
        },
      },
      '/orders': {
        post: {
          operationId: 'placeOrder',
          summary: 'Place an order; the outcome follows asynchronously',
          requestBody: { required: true, ...json(placedOrder, 'The order', 'input') },
          responses: {
            '202': json(orderAccepted, 'Accepted and published to orders.placed'),
            '400': error('Not JSON, or not a valid order (including a total that does not match its lines)'),
            '413': error('Request body over 64 KB'),
            '503': error('The service is still starting'),
          },
        },
      },
      '/orders/{id}': {
        get: {
          operationId: 'getOrder',
          summary: 'An order and its outcome',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '200': json(orderView, 'The order'), '404': error('No order with that id') },
        },
      },
      '/products/{sku}': {
        put: {
          operationId: 'upsertProduct',
          summary: 'Create a product, or replace its name, price and stock',
          parameters: [
            { name: 'sku', in: 'path', required: true, schema: { type: 'string', pattern: SKU_PATTERN } },
          ],
          requestBody: { required: true, ...json(productUpsert, 'The product', 'input') },
          responses: {
            '200': json(productView, 'Replaced'),
            '201': json(productView, 'Created'),
            '400': error('Not a valid product'),
          },
        },
      },
    },
  };
}
