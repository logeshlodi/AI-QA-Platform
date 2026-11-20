import { test as base, expect, type APIRequestContext } from '@playwright/test';
import { aProduct, type Product } from '@aiqa/test-data-engine';
import { MongoClient, type Db } from 'mongodb';
import pg from 'pg';
import { clientToken, CLIENTS } from './auth';
import { KafkaBus } from './bus';
import { ContractChecker, type OpenApiDocument } from './openapi';
import { stack, TOPICS } from './stack';

interface WorkerFixtures {
  db: pg.Pool;
  mongo: Db;
  bus: KafkaBus;
  /** The service's own OpenAPI document (GET /openapi.json), ready to check responses against. */
  contract: ContractChecker;
  /** Whether the service asks for tokens on product writes (its OpenAPI document says so). */
  authEnabled: boolean;
}

interface TestFixtures {
  service: APIRequestContext;
  /** The service as a catalog-admin client: a Keycloak token on every request when auth is on. */
  catalogAdmin: APIRequestContext;
  /** Puts products in the catalogue for this test only, with unique SKUs, and removes them after. */
  stockProducts: (products: Product[]) => Promise<Product[]>;
  /** A seed for this test's data, recorded on the test so a failure can be replayed with AIQA_SEED. */
  seed: number;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  db: [
    async ({}, use) => {
      const pool = new pg.Pool({ connectionString: stack.databaseUrl, max: 4 });
      await use(pool);
      await pool.end();
    },
    { scope: 'worker' },
  ],
  mongo: [
    async ({}, use) => {
      const client = await MongoClient.connect(stack.mongoUrl);
      await use(client.db(stack.mongoDb));
      await client.close();
    },
    { scope: 'worker' },
  ],
  bus: [
    async ({}, use) => {
      const bus = new KafkaBus(stack.kafkaBrokers);
      await bus.connect([TOPICS.confirmed, TOPICS.rejected, TOPICS.deadLetter]);
      await use(bus);
      await bus.disconnect();
    },
    { scope: 'worker', timeout: 60_000 },
  ],
  contract: [
    async ({ playwright }, use) => {
      const request = await playwright.request.newContext({ baseURL: stack.serviceUrl });
      const response = await request.get('/openapi.json');
      if (!response.ok()) throw new Error(`GET /openapi.json answered ${response.status()}`);
      const document = (await response.json()) as OpenApiDocument;
      await request.dispose();
      await use(new ContractChecker(document));
    },
    { scope: 'worker' },
  ],
  authEnabled: [
    async ({ contract }, use) => {
      await use('securitySchemes' in ((contract.document as { components?: object }).components ?? {}));
    },
    { scope: 'worker' },
  ],
  catalogAdmin: async ({ playwright, authEnabled }, use) => {
    const headers = authEnabled
      ? { authorization: `Bearer ${await clientToken(CLIENTS.catalogAdmin)}` }
      : undefined;
    const request = await playwright.request.newContext({
      baseURL: stack.serviceUrl,
      extraHTTPHeaders: headers,
    });
    await use(request);
    await request.dispose();
  },
  service: async ({ playwright }, use) => {
    const request = await playwright.request.newContext({ baseURL: stack.serviceUrl });
    await use(request);
    await request.dispose();
  },
  seed: async ({}, use, testInfo) => {
    const fromEnv = Number(process.env.AIQA_SEED);
    const seed = Number.isInteger(fromEnv) && fromEnv > 0 ? fromEnv : Math.floor(Math.random() * 2 ** 31);
    testInfo.annotations.push({ type: 'seed', description: `AIQA_SEED=${seed}` });
    await use(seed);
  },
  stockProducts: async ({ db }, use) => {
    const added: string[] = [];
    await use(async (products) => {
      for (const p of products) {
        await db.query('INSERT INTO products (sku, name, price_cents, stock) VALUES ($1, $2, $3, $4)', [
          p.sku,
          p.name,
          p.priceCents,
          p.stock,
        ]);
        added.push(p.sku);
      }
      return products;
    });
    // Order lines keep their SKU as text, so products can go once the test is done.
    if (added.length > 0) await db.query('DELETE FROM products WHERE sku = ANY($1)', [added]);
  },
});

export { expect };

/** Fresh products for one test: random SKUs never collide with another test's. */
export const freshProducts = (seed: number, count: number, overrides: Partial<Product> = {}): Product[] =>
  aProduct(seed).with(overrides).buildMany(count);
