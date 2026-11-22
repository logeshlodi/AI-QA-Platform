import { describe, expect, it } from 'vitest';
import type { ResultRecord, StoredRun } from '@aiqa/reporting-engine';
import { customerSchema, productSchema } from '@aiqa/test-data-engine';
import {
  A11Y_CASES,
  AGENT_EVALS,
  caseProblem,
  diagnoseFlaky,
  edgeCaseData,
  FLAKY_CASES,
  flakyCauseByRules,
  huntFlaky,
  inventedNumbers,
  MemoryRunLog,
  namesNotOnPage,
  operationsOf,
  planApiTests,
  rankA11yFindings,
  renderApiSpec,
  reportRun,
  REPORTER_CASES,
  runFacts,
  schemaValidator,
} from '../src';
import { scriptedModel } from './mock';

const mock = (turns: Parameters<typeof scriptedModel>[0]) => ({
  model: scriptedModel(turns).model,
  label: 'mock',
});

const OPENAPI = {
  openapi: '3.1.0',
  paths: {
    '/health': { get: { operationId: 'health', responses: { '200': {}, '503': {} } } },
    '/orders': {
      post: {
        operationId: 'placeOrder',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['id', 'qty'],
                properties: { id: { type: 'string', format: 'uuid' }, qty: { type: 'integer', minimum: 1 } },
              },
            },
          },
        },
        responses: { '202': {}, '400': {} },
      },
    },
    '/orders/{id}': { get: { operationId: 'getOrder', responses: { '200': {}, '404': {} } } },
    '/products/{sku}': {
      put: {
        operationId: 'upsertProduct',
        security: [{ oauth2: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: { name: { type: 'string', minLength: 1 } },
              },
            },
          },
        },
        responses: { '200': {}, '201': {}, '400': {}, '401': {}, '403': {} },
      },
    },
  },
};

describe('flaky hunter', () => {
  it('rules name a cause from the error text when there is no model', () => {
    expect(flakyCauseByRules(FLAKY_CASES.find((c) => c.id === 'heroku-sleep')!.input)).toBe(
      'external-service',
    );
    expect(flakyCauseByRules(FLAKY_CASES.find((c) => c.id === 'booking-count')!.input)).toBe('shared-data');
    expect(flakyCauseByRules(FLAKY_CASES.find((c) => c.id === 'spinner-wait')!.input)).toBe('timing');
  });

  it('uses the model when it answers', async () => {
    const d = await diagnoseFlaky(FLAKY_CASES[3]!.input, {
      model: mock([
        {
          answer: {
            cause: 'test-order',
            explanation: 'The cart is empty when it runs first.',
            fix: 'Add the item in a fixture.',
          },
        },
      ]),
    });
    expect(d).toMatchObject({ cause: 'test-order', source: 'model' });
  });

  it('finds flaky tests in the history, reruns them, and says confirmed, quiet or broken', async () => {
    const r = (runId: string, testId: string, status: ResultRecord['status'], retry = 0): ResultRecord => ({
      runId,
      testId,
      retry,
      title: `t ${testId}`,
      file: 'a.spec.ts',
      project: 'chromium',
      status,
      durationMs: 1,
      errorMessage:
        status === 'passed' ? undefined : 'Error: Timed out 5000ms waiting for expect(locator).toBeVisible()',
    });
    const history: StoredRun[] = ['p', 'f', 'p', 'f', 'p'].map((o, i) => ({
      run: {
        id: `r${i}`,
        suite: 'ui',
        startedAt: `2026-11-0${i + 1}T00:00:00Z`,
        finishedAt: `2026-11-0${i + 1}T00:01:00Z`,
        environment: 'local',
      },
      results: [r(`r${i}`, 'x', o === 'p' ? 'passed' : 'failed'), r(`r${i}`, 'steady', 'passed')],
    }));
    const findings = await huntFlaky(history, { rerun: async () => ({ passed: 4, failed: 1 }) });
    expect(findings.map((f) => f.test.testId)).toEqual(['x']);
    expect(findings[0]).toMatchObject({
      verdict: 'confirmed',
      diagnosis: { cause: 'timing', source: 'rules' },
    });
    expect(findings[0]!.quarantineNote).toMatch(/Rerun now: 4 passed, 1 failed/);
  });
});

describe('test data agent', () => {
  it('keeps only schema-valid model records and builds every edge the model missed', async () => {
    const log = new MemoryRunLog();
    const result = await edgeCaseData('product', {
      model: mock([
        {
          answer: {
            records: [
              { sku: 'ABC-12345', name: 'X', category: 'books', priceCents: 1, stock: 0 },
              { sku: 'bad', name: 'Y', category: 'books', priceCents: 1, stock: 1 },
            ],
          },
        },
      ]),
      log,
    });
    expect(result.modelProposed).toBe(2);
    expect(result.rejected).toEqual([expect.objectContaining({ problem: expect.stringMatching(/^sku/) })]);
    expect(result.reachedByModel.sort()).toEqual(['name-shortest', 'price-lowest', 'stock-zero']);
    for (const { record } of result.records) expect(productSchema.safeParse(record).success).toBe(true);
    const reached = new Set(result.records.flatMap((r) => r.boundaries));
    expect([...reached].sort()).toEqual([
      'name-longest',
      'name-shortest',
      'name-unicode',
      'price-lowest',
      'stock-zero',
    ]);
  });

  it('without a model, builds every edge from the builders', async () => {
    const result = await edgeCaseData('customer');
    expect(result.records.every((r) => r.source === 'builder')).toBe(true);
    for (const { record } of result.records) expect(customerSchema.safeParse(record).success).toBe(true);
    expect(result.records).toHaveLength(5);
  });
});

describe('accessibility agent', () => {
  it('ranks by the model, keeps axe levels for findings it skipped, fix-now first', async () => {
    const findings = A11Y_CASES.slice(5, 8).map((c) => c.finding); // color-contrast, html-has-lang, region
    const ranked = await rankA11yFindings(findings, {
      model: mock([
        {
          answer: {
            findings: [
              { id: 'region', priority: 'later', userImpact: 'Screen reader users navigate by landmarks.' },
              {
                id: 'color-contrast',
                priority: 'fix-soon',
                userImpact: 'Low-vision users struggle to read the footer.',
              },
            ],
          },
        },
      ]),
    });
    expect(ranked.map((r) => [r.id, r.priority, r.source])).toEqual([
      ['html-has-lang', 'fix-now', 'rules'],
      ['color-contrast', 'fix-soon', 'model'],
      ['region', 'later', 'model'],
    ]);
  });
});

describe('run reporter', () => {
  const facts = REPORTER_CASES.find((c) => c.id === 'one-product-bug')!.facts;

  it('accepts a summary whose numbers all come from the facts and that names every failure', async () => {
    const report = await reportRun(facts, {
      model: mock([
        {
          answer: {
            markdown:
              'Act on this run: 1 product bug. inventory › lists six products failed (Expected: 6 Received: 5). Pass rate 97.9%, down 2.1 points; 46 of 48 passed.',
          },
        },
      ]),
    });
    expect(report.source).toBe('model');
  });

  it('throws away a summary with an invented number, and says which', async () => {
    const report = await reportRun(facts, {
      model: mock([
        { answer: { markdown: 'inventory › lists six products failed; pass rate 96% across 50 tests.' } },
      ]),
    });
    expect(report).toMatchObject({ source: 'rules', reason: expect.stringMatching(/96, 50/) });
    expect(report.markdown).toContain('46 of 48 passed');
  });

  it('computes the facts from the run history', () => {
    const result = (runId: string, testId: string, status: ResultRecord['status']): ResultRecord => ({
      runId,
      testId,
      retry: 0,
      title: `t ${testId}`,
      file: 'f',
      project: 'p',
      status,
      durationMs: 1000,
    });
    const history: StoredRun[] = [
      {
        run: {
          id: 'a',
          suite: 'ui',
          startedAt: '2026-11-01T00:00:00Z',
          finishedAt: '2026-11-01T00:06:00Z',
          environment: 'local',
        },
        results: [result('a', '1', 'passed'), result('a', '2', 'passed')],
      },
      {
        run: {
          id: 'b',
          suite: 'ui',
          startedAt: '2026-11-02T00:00:00Z',
          finishedAt: '2026-11-02T00:06:00Z',
          environment: 'local',
        },
        results: [result('b', '1', 'passed'), result('b', '2', 'failed')],
      },
    ];
    const f = runFacts(history, 'ui', { '2': 'product' })!;
    expect(f).toMatchObject({
      runId: 'b',
      total: 2,
      failed: 1,
      passRate: 50,
      passRateChange: -50,
      failures: [{ title: 't 2', label: 'product' }],
    });
    expect(inventedNumbers('50% passed, 1 failed of 2', f)).toEqual([]);
  });
});

describe('API tester', () => {
  const ops = operationsOf(OPENAPI);
  const validate = schemaValidator();

  it('reads the operations, their request schemas, answers and security', () => {
    expect(ops.map((o) => `${o.method} ${o.path} ${o.secured}`)).toEqual([
      'get /health false',
      'post /orders false',
      'get /orders/{id} false',
      'put /products/{sku} true',
    ]);
  });

  it('accepts only cases the document allows', () => {
    const c = (over: object) => ({
      operationId: 'placeOrder',
      name: 'a case',
      path: '/orders',
      body: { id: '3f6c1a2e-8b4d-4c7a-9e21-5d0b7c9a1f30', qty: 1 },
      expectedStatus: 202,
      why: 'because',
      ...over,
    });
    expect(caseProblem(c({}), ops, validate)).toBeUndefined();
    expect(caseProblem(c({ body: { id: 'x', qty: 0 }, expectedStatus: 400 }), ops, validate)).toBeUndefined();
    expect(caseProblem(c({ body: { id: 'x', qty: 0 } }), ops, validate)).toMatch(/breaks the schema/);
    expect(caseProblem(c({ expectedStatus: 400 }), ops, validate)).toMatch(/body is valid/);
    expect(caseProblem(c({ expectedStatus: 500 }), ops, validate)).toMatch(/not a documented answer/);
    expect(
      caseProblem(
        c({ operationId: 'getOrder', path: '/orders', body: undefined, expectedStatus: 404 }),
        ops,
        validate,
      ),
    ).toMatch(/does not match/);
    expect(
      caseProblem(
        c({ operationId: 'getOrder', path: '/orders/1', body: undefined, expectedStatus: 401 }),
        ops,
        validate,
      ),
    ).toMatch(/not a documented answer/);
  });

  it('adds a case for every operation the model missed, and renders a spec with the right client', async () => {
    const plan = await planApiTests(OPENAPI, {
      // One call per operation, in document order: health, placeOrder, getOrder, upsertProduct.
      model: mock([
        { fail: 'timeout' },
        {
          answer: {
            cases: [
              { name: 'made-up status', path: '/orders', body: {}, expectedStatus: 418, why: 'teapot' },
            ],
          },
        },
        { text: 'not json' },
        {
          answer: {
            cases: [
              {
                name: 'creates a product',
                path: '/products/AGT-1',
                body: { name: 'Pen' },
                expectedStatus: 201,
                why: 'valid',
              },
              {
                name: 'refuses without a token',
                path: '/products/AGT-1',
                body: { name: 'Pen' },
                expectedStatus: 401,
                why: 'no token',
              },
            ],
          },
        },
      ]),
    });
    expect(plan.rejected).toHaveLength(1);
    expect(plan.uncoveredByModel).toEqual(['health', 'placeOrder', 'getOrder']);
    expect(plan.cases.map((c) => `${c.operationId}:${c.expectedStatus}:${c.source}`)).toEqual([
      'upsertProduct:201:model',
      'upsertProduct:401:model',
      'health:200:rules',
      'placeOrder:400:rules',
      'getOrder:404:rules',
    ]);
    const spec = renderApiSpec([...plan.cases, plan.cases[0]!], 'order service');
    expect(spec).toContain(
      'const response = await catalogAdmin.put("/products/AGT-1", { data: {"name":"Pen"} });',
    );
    expect(spec).toContain(
      'async ({ service }) => {\n    const response = await service.put("/products/AGT-1"',
    );
    expect(spec).toContain('test("creates a product (2)"');
  });
});

describe('agent evals', () => {
  it('cover all nine agents but the generator, which needs a browser', () => {
    expect(AGENT_EVALS.map((e) => e.agent).sort()).toEqual([
      'accessibility',
      'api-tester',
      'flaky',
      'healing-review',
      'planner',
      'run-reporter',
      'test-data',
      'triage',
    ]);
  });

  it('the planner check catches names that are not on the page', () => {
    expect(
      namesNotOnPage(
        ['Click "Login"', "Type into 'Username'", 'Click "Sign up"'],
        '- button "Login"\n- textbox "Username"',
      ),
    ).toEqual(['Sign up']);
  });

  it('run with a model that always fails, every eval reports instead of crashing', async () => {
    for (const e of AGENT_EVALS.filter((x) => !['triage', 'planner'].includes(x.agent))) {
      const report = await e.run({ model: mock([{ fail: 'offline' }]), openApi: OPENAPI });
      expect(report.total, e.agent).toBeGreaterThan(0);
    }
  });
});
