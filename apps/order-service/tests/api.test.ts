import { Validator } from '@seriousme/openapi-schema-validator';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { openApiDocument } from '../src/api';
import {
  confirmedEvent,
  deadLetterEvent,
  orderConfirmed,
  orderDeadLettered,
  orderRejected,
  rejectedEvent,
} from '../src/events';

type Doc = ReturnType<typeof openApiDocument>;
const doc: Doc = openApiDocument();

/** The JSON Schema for one response in the document. */
function responseSchema(path: keyof Doc['paths'], method: string, status: string): object {
  const operation = (doc.paths[path] as Record<string, { responses: Record<string, unknown> }>)[method];
  const response = operation?.responses[status] as
    { content: { 'application/json': { schema: object } } } | undefined;
  if (!response) throw new Error(`${method.toUpperCase()} ${path} documents no ${status} response`);
  return response.content['application/json'].schema;
}

const ajv = addFormats(new Ajv2020({ allErrors: true, strict: false }));

describe('the OpenAPI document', () => {
  it('is a valid OpenAPI 3.1 document', async () => {
    const result = await new Validator().validate(structuredClone(doc));
    expect(result.errors ?? []).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('documents every route the service serves', () => {
    expect(Object.keys(doc.paths).sort()).toEqual(['/health', '/orders', '/orders/{id}', '/products/{sku}']);
  });

  // A schema that accepts everything would make every contract check pass. These prove the
  // generated schemas still say something: a good body passes, a body with one thing wrong fails.
  it('describes an order closely enough to tell a good response from a bad one', () => {
    const check = ajv.compile(responseSchema('/orders/{id}', 'get', '200'));
    const good = {
      id: '0b6f4a50-6a39-4a8e-9a39-3a8b5f1f3c11',
      customerId: '6f2c1d3e-9b8a-4c7d-8e6f-5a4b3c2d1e0f',
      status: 'confirmed',
      totalCents: 2400,
      currency: 'USD',
      rejectionReason: null,
      lines: [{ sku: 'SKU-1', quantity: 2, unitPriceCents: 1200 }],
    };
    expect(check(good), JSON.stringify(check.errors)).toBe(true);
    expect(check({ ...good, status: 'shipped' })).toBe(false);
    expect(check({ ...good, id: 'not-a-uuid' })).toBe(false);
    expect(check({ ...good, lines: [] })).toBe(false);
    const withoutCurrency: Partial<typeof good> = { ...good };
    delete withoutCurrency.currency;
    expect(check(withoutCurrency)).toBe(false);
  });

  it('documents the request body with the same rules the service applies', () => {
    const operation = doc.paths['/orders'].post;
    const check = ajv.compile(operation.requestBody.content['application/json'].schema);
    const line = { sku: 'SKU-1', quantity: 1, unitPriceCents: 500 };
    const order = {
      id: crypto.randomUUID(),
      customerId: crypto.randomUUID(),
      currency: 'USD',
      totalCents: 500,
      lines: [line],
    };
    expect(check(order)).toBe(true);
    expect(check({ ...order, lines: [{ ...line, quantity: 100 }] })).toBe(false);
    expect(check({ ...order, currency: 'EUR' })).toBe(false);
  });
});

describe('the published events', () => {
  const order = {
    id: crypto.randomUUID(),
    customerId: crypto.randomUUID(),
    currency: 'USD' as const,
    totalCents: 900,
    lines: [{ sku: 'SKU-1', quantity: 3, unitPriceCents: 300 }],
  };

  it('are built to their own schemas', () => {
    expect(orderConfirmed.parse(confirmedEvent(order))).toEqual({ orderId: order.id, totalCents: 900 });
    expect(orderRejected.parse(rejectedEvent(order, 'out of stock: SKU-1'))).toEqual({
      orderId: order.id,
      reason: 'out of stock: SKU-1',
    });
    expect(orderDeadLettered.parse(deadLetterEvent('not JSON', undefined))).toEqual({
      reason: 'not JSON',
      payload: null,
    });
  });
});
