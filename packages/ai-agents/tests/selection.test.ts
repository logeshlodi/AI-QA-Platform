import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { StoredRun } from '@aiqa/reporting-engine';
import {
  buildImportGraph,
  globToRegExp,
  MemoryRunLog,
  runCommands,
  selectByRules,
  selectTests,
  specHistory,
  type ImpactMap,
  type ImportGraph,
} from '../src';
import { scriptedModel } from './mock';

// A small workspace with the same shape as this repository: page objects and flows behind a
// fixtures file every spec imports, an auto fixture, a data file, a shared package with a barrel,
// and a service tested from outside.
const FILES: Record<string, string> = {
  'packages/fw/package.json': '{"name":"@x/fw"}',
  'packages/shared/package.json': '{"name":"@x/shared","main":"./src/index.ts"}',
  'packages/shared/src/index.ts': "export * from './money';\nexport * from './log';\n",
  'packages/shared/src/money.ts': 'export const formatMoney = (c: number) => `$${c / 100}`;\n',
  'packages/shared/src/log.ts': 'export const logLine = (s: string) => s;\n',
  'packages/fw/src/pages/cart.page.ts':
    "import { formatMoney } from '@x/shared';\nexport class CartPage { total = formatMoney(1); }\n",
  'packages/fw/src/pages/login.page.ts': 'export class LoginPage {}\n',
  'packages/fw/src/flows/checkout.flow.ts':
    "import type { CartPage } from '../pages/cart.page';\nexport class CheckoutFlow { constructor(readonly cart: CartPage) {} }\n",
  'packages/fw/src/checks/tracker.ts': 'export class RequestTracker {}\n',
  'packages/fw/src/fixtures/index.ts': [
    "import { CartPage } from '../pages/cart.page';",
    "import { LoginPage } from '../pages/login.page';",
    "import { CheckoutFlow } from '../flows/checkout.flow';",
    "import { RequestTracker } from '../checks/tracker';",
    'export const test = base.extend({',
    '  cartPage: async ({}, use) => use(new CartPage()),',
    '  loginPage: async ({}, use) => use(new LoginPage()),',
    '  checkoutFlow: async ({ cartPage }, use) => use(new CheckoutFlow(cartPage)),',
    '  tracker: [',
    '    async ({}, use) => { const t = new RequestTracker(); await use(t); },',
    '    { auto: true },',
    '  ],',
    '});',
    '',
  ].join('\n'),
  'packages/fw/tests/data/users.csv': 'name\nann\n',
  'packages/fw/tests/checkout.spec.ts':
    "import { test } from '../src/fixtures';\ntest('buys', async ({ checkoutFlow }) => {});\n",
  'packages/fw/tests/cart.spec.ts':
    "import { test } from '../src/fixtures';\ntest('cart total', async ({ cartPage }) => {});\n",
  'packages/fw/tests/login.spec.ts':
    "import { test } from '../src/fixtures';\ntest('signs in', async ({ loginPage }) => {});\n",
  'packages/fw/tests/users.spec.ts':
    "import { test } from '../src/fixtures';\nconst f = 'users.csv';\ntest('users from csv', async () => {});\n",
  'packages/fw/tests/about.spec.ts':
    "import { test } from '../src/fixtures';\ntest('about page', async () => {});\n",
  'apps/svc/src/orders.ts': 'export const placeOrder = () => 1;\n',
  'packages/data/package.json': '{"name":"@x/data"}',
  'packages/data/tests/orders.spec.ts': "test('places an order over HTTP', async () => {});\n",
  'docs/guide.md': '# guide\n',
};

const IMPACT: ImpactMap = {
  runEverything: ['package.json', 'packages/*/playwright.config.ts'],
  ignore: ['docs/**', '**/*.md'],
  covers: [{ source: ['apps/svc/**'], specs: ['packages/data/tests/**/*.spec.ts'], why: 'tested over HTTP' }],
};

let root: string;
let graph: ImportGraph;
const base = () => ({ root, graph, impact: IMPACT, hubSize: 3 });
const specs = (list: { spec: string }[]) => list.map((s) => s.spec.split('/').pop());

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiqa-select-'));
  for (const [file, text] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  graph = buildImportGraph(root);
});

describe('risk-based selection: rules', () => {
  it('runs a changed spec itself, first', () => {
    const r = selectByRules(['packages/fw/tests/login.spec.ts'], base());
    expect(r.selected[0]).toMatchObject({ spec: 'packages/fw/tests/login.spec.ts', score: 100 });
  });

  it('through the fixtures file, runs only the specs that use the changed page object, also through a flow', () => {
    const r = selectByRules(['packages/fw/src/pages/cart.page.ts'], base());
    expect(specs(r.selected)).toEqual(['cart.spec.ts', 'checkout.spec.ts']);
    expect(specs(r.reachableOnly)).toEqual(expect.arrayContaining(['login.spec.ts', 'about.spec.ts']));
  });

  it('runs every spec of a fixtures file when the change is used by one of its auto fixtures', () => {
    const r = selectByRules(['packages/fw/src/checks/tracker.ts'], base());
    expect(r.selected).toHaveLength(5);
    expect(r.reachableOnly).toHaveLength(0);
  });

  it('follows a change through a shared package to the page object that uses it', () => {
    const r = selectByRules(['packages/shared/src/money.ts'], base());
    expect(specs(r.selected)).toEqual(expect.arrayContaining(['cart.spec.ts', 'checkout.spec.ts']));
    expect(specs(r.selected)).not.toContain('login.spec.ts');
  });

  it('runs the specs that read a changed data file', () => {
    const r = selectByRules(['packages/fw/tests/data/users.csv'], base());
    expect(specs(r.selected)).toEqual(['users.spec.ts']);
  });

  it('uses test-impact.json for code tested from outside, and ignores documentation', () => {
    const r = selectByRules(['apps/svc/src/orders.ts', 'docs/guide.md'], base());
    expect(specs(r.selected)).toEqual(['orders.spec.ts']);
    expect(r.selected[0]?.reasons[0]).toMatchObject({ kind: 'covers', why: 'tested over HTTP' });
    expect(r.ignored).toEqual(['docs/guide.md']);
    expect(r.uncovered).toEqual([]);
  });

  it('tells code only unit tests reach apart from code nothing tests', () => {
    fs.writeFileSync(
      path.join(root, 'packages/fw/src/util.ts'),
      'export const add = (a: number, b: number) => a + b;\n',
    );
    fs.writeFileSync(path.join(root, 'packages/fw/src/util.test.ts'), "import { add } from './util';\n");
    const r = selectByRules(['packages/fw/src/util.ts', 'packages/fw/src/util.test.ts'], {
      ...base(),
      graph: buildImportGraph(root),
    });
    expect(r.unitTested).toEqual(['packages/fw/src/util.test.ts', 'packages/fw/src/util.ts']);
    expect(r.uncovered).toEqual([]);
  });

  it('names changed code that no spec reaches, so a reviewer can ask for a test', () => {
    fs.writeFileSync(path.join(root, 'packages/fw/src/pages/orphan.ts'), 'export const orphan = 1;\n');
    const r = selectByRules(['packages/fw/src/pages/orphan.ts'], {
      ...base(),
      graph: buildImportGraph(root),
    });
    expect(r.selected).toHaveLength(0);
    expect(r.uncovered).toEqual(['packages/fw/src/pages/orphan.ts']);
  });

  it('runs everything when the config or the lockfile changes', () => {
    const r = selectByRules(['package.json'], base());
    expect(r.everything).toBe(true);
  });

  it('includes the "shared" specs when asked', () => {
    const r = selectByRules(['packages/fw/src/pages/cart.page.ts'], { ...base(), includeShared: true });
    expect(r.selected).toHaveLength(5);
  });
});

describe('risk-based selection: history and budget', () => {
  const run = (id: string, at: string, failing: string[]): StoredRun => ({
    run: { id, suite: 'ui', startedAt: at, finishedAt: at, environment: 'local' },
    results: ['tests/cart.spec.ts', 'tests/checkout.spec.ts'].map((file) => ({
      runId: id,
      testId: file,
      retry: 0,
      title: file,
      file,
      project: 'chromium',
      status: failing.includes(file) ? 'failed' : 'passed',
      durationMs: 60_000,
    })),
  });

  it('ranks the spec that failed lately above one that never fails', () => {
    const history = specHistory([
      run('1', '2026-11-01', []),
      run('2', '2026-11-02', ['tests/checkout.spec.ts']),
    ]);
    // specHistory maps the "ui" suite to packages/playwright-framework; point it at this workspace.
    const local = new Map(
      [...history].map(([k, v]) => [k.replace('packages/playwright-framework', 'packages/fw'), v]),
    );
    const r = selectByRules(['packages/fw/src/pages/cart.page.ts'], { ...base(), history: local });
    expect(specs(r.selected)).toEqual(['checkout.spec.ts', 'cart.spec.ts']);
    expect(r.selected[0]!.score).toBeGreaterThan(r.selected[1]!.score);
  });

  it('cuts the lowest-ranked specs past the time budget, but always keeps a changed spec', () => {
    const history = new Map([
      ['packages/fw/tests/cart.spec.ts', { runs: 1, failedRuns: 0, flakyRuns: 0, averageMs: 60_000 }],
      ['packages/fw/tests/checkout.spec.ts', { runs: 1, failedRuns: 0, flakyRuns: 0, averageMs: 60_000 }],
    ]);
    const r = selectByRules(['packages/fw/src/pages/cart.page.ts', 'packages/fw/tests/login.spec.ts'], {
      ...base(),
      history,
      budgetMs: 90_000, // login (20 s, unknown) + one 60 s spec fits; the second does not
    });
    expect(specs(r.selected)).toContain('login.spec.ts');
    expect(r.overBudget).toHaveLength(1);
  });
});

describe('risk-based selection: the model only adds', () => {
  it('adds a real unpicked spec with its reason, and ignores invented or already-picked ones', async () => {
    const model = scriptedModel([
      {
        answer: {
          add: [
            { spec: 'packages/fw/tests/about.spec.ts', why: 'the about page shows the cart total' },
            { spec: 'packages/fw/tests/made-up.spec.ts', why: 'does not exist at all' },
            { spec: 'packages/fw/tests/cart.spec.ts', why: 'already picked by the rules' },
          ],
        },
      },
    ]);
    const log = new MemoryRunLog();
    const r = await selectTests(['packages/fw/src/pages/cart.page.ts'], {
      ...base(),
      model: { model: model.model, label: 'mock' },
      log,
    });
    expect(specs(r.selected)).toEqual(['cart.spec.ts', 'checkout.spec.ts', 'about.spec.ts']);
    expect(r.selected.at(-1)?.reasons).toEqual([
      { kind: 'model', why: 'the about page shows the cart total' },
    ]);
    expect(r.model).toMatchObject({ asked: true, added: 1 });
    expect(r.model.reason).toContain('2 suggestion(s) ignored');
    expect(log.records[0]).toMatchObject({ agent: 'select', source: 'model' });
  });

  it('keeps the rules’ selection when the model fails', async () => {
    const model = scriptedModel([{ fail: 'connection refused' }]);
    const r = await selectTests(['packages/fw/src/pages/cart.page.ts'], {
      ...base(),
      model: { model: model.model, label: 'mock' },
    });
    expect(specs(r.selected)).toEqual(['cart.spec.ts', 'checkout.spec.ts']);
    expect(r.model.reason).toContain('model failed');
  });

  it('does not ask the model when everything runs anyway', async () => {
    const model = scriptedModel([{ answer: { add: [] } }]);
    await selectTests(['package.json'], { ...base(), model: { model: model.model, label: 'mock' } });
    expect(model.calls()).toBe(0);
  });
});

describe('risk-based selection: helpers', () => {
  it('matches globs the way test-impact.json uses them', () => {
    expect(globToRegExp('apps/svc/**').test('apps/svc/src/a/b.ts')).toBe(true);
    expect(globToRegExp('packages/*/playwright.config.ts').test('packages/fw/playwright.config.ts')).toBe(
      true,
    );
    expect(globToRegExp('packages/*/playwright.config.ts').test('packages/fw/x/playwright.config.ts')).toBe(
      false,
    );
    expect(globToRegExp('**/*.md').test('README.md')).toBe(true);
  });

  it('turns the selection into one command per package', () => {
    const r = selectByRules(['packages/fw/src/pages/cart.page.ts', 'apps/svc/src/orders.ts'], base());
    expect(runCommands(root, r.selected)).toEqual([
      'pnpm --filter @x/fw exec playwright test tests/cart.spec.ts tests/checkout.spec.ts',
      'pnpm --filter @x/data exec playwright test tests/orders.spec.ts',
    ]);
  });
});
