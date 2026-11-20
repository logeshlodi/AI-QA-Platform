import { Validator } from '@seriousme/openapi-schema-validator';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { openApiDocument } from '../src/api';
import { MAX_DB_INTEGER, placedOrder, productUpsert } from '../src/contract';
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

// One validator for the file: building it compiles the OpenAPI 3.1 meta-schema, which takes seconds
// on a busy machine. Each test then only validates.
const openApi = new Validator();

const ajv = addFormats(new Ajv2020({ allErrors: true, strict: false }));

describe('the OpenAPI document', () => {
  it('is a valid OpenAPI 3.1 document', { timeout: 30_000 }, async () => {
    const result = await openApi.validate(structuredClone(doc));
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

describe('amounts the database can hold', () => {
  const tooBig = MAX_DB_INTEGER + 1;
  const line = { sku: 'SKU-1', quantity: 1, unitPriceCents: 500 };
  const order = {
    id: crypto.randomUUID(),
    customerId: crypto.randomUUID(),
    currency: 'USD' as const,
    totalCents: 500,
    lines: [line],
  };

  // Regression: a price over the INTEGER column's range passed validation, then failed in Postgres.
  // Over HTTP that was a 500; over Kafka it stopped the service on that message, again on every restart.
  it('refuses prices, stock and totals above the column range', () => {
    expect(productUpsert.safeParse({ name: 'x', priceCents: tooBig, stock: 1 }).success).toBe(false);
    expect(productUpsert.safeParse({ name: 'x', priceCents: 1, stock: tooBig }).success).toBe(false);
    expect(
      placedOrder.safeParse({ ...order, totalCents: tooBig, lines: [{ ...line, unitPriceCents: tooBig }] })
        .success,
    ).toBe(false);
    expect(
      productUpsert.safeParse({ name: 'x', priceCents: MAX_DB_INTEGER, stock: MAX_DB_INTEGER }).success,
    ).toBe(true);
  });

  // Regression: a NUL in a product name passed validation and failed in Postgres (a 500, found by ZAP).
  it('refuses control characters in names and SKUs the path would not accept', () => {
    expect(productUpsert.safeParse({ name: 'lamp\u0000', priceCents: 1, stock: 1 }).success).toBe(false);
    expect(productUpsert.safeParse({ name: 'lamp\nshade', priceCents: 1, stock: 1 }).success).toBe(false);
    expect(productUpsert.safeParse({ name: 'Lampe à poser, 40 cm', priceCents: 1, stock: 1 }).success).toBe(
      true,
    );
    expect(placedOrder.safeParse({ ...order, lines: [{ ...line, sku: 'SKU\u00001' }] }).success).toBe(false);
    expect(placedOrder.safeParse({ ...order, lines: [{ ...line, sku: '../../etc' }] }).success).toBe(false);
  });

  it('publishes the limit in the OpenAPI document', () => {
    const body = doc.paths['/products/{sku}'].put.requestBody.content['application/json'].schema as {
      properties: Record<string, { maximum?: number }>;
    };
    expect(body.properties.priceCents?.maximum).toBe(MAX_DB_INTEGER);
    expect(body.properties.stock?.maximum).toBe(MAX_DB_INTEGER);
  });
});

describe('the OpenAPI document with auth on', () => {
  const issuer = 'http://localhost:8180/realms/aiqa';
  const secured = openApiDocument({
    auth: { issuer, audience: 'order-service', jwksUrl: `${issuer}/certs` },
  });

  it('is still valid OpenAPI 3.1, and says which operation needs a token', { timeout: 30_000 }, async () => {
    const result = await openApi.validate(structuredClone(secured));
    expect(result.errors ?? []).toEqual([]);
    const put = secured.paths['/products/{sku}'].put as {
      security?: unknown;
      responses: Record<string, unknown>;
    };
    expect(put.security).toEqual([{ catalogAdmin: [] }]);
    expect(Object.keys(put.responses).sort()).toEqual(['200', '201', '400', '401', '403']);
    expect(secured.components?.securitySchemes.catalogAdmin.flows.clientCredentials.tokenUrl).toBe(
      `${issuer}/protocol/openid-connect/token`,
    );
  });

  it('leaves reading and ordering open', () => {
    expect('security' in secured.paths['/orders'].post).toBe(false);
    expect('security' in secured.paths['/orders/{id}'].get).toBe(false);
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
