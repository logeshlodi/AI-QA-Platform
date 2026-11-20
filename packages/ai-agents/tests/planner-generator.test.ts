import { describe, expect, it } from 'vitest';
import { generateSpec, MemoryRunLog, parsePlan, planPage, renderPlan, type TestPlan } from '../src';
import { scriptedModel } from './mock';

const SNAPSHOT = `- text: Swag Labs
- combobox "Sort":
  - option "Name (A to Z)" [selected]
  - option "Price (low to high)"
- link "Sauce Labs Backpack"
- button "Add to cart"`;

const PLAN: TestPlan = {
  title: 'Inventory page',
  overview: 'The product list after login: sorting, product links and the cart.',
  scenarios: [
    {
      title: 'Sort by price, low to high',
      steps: ['Choose "Price (low to high)" in the Sort box'],
      expected: ['The first product is the cheapest'],
    },
    {
      title: 'Add the backpack to the cart',
      steps: ['Click "Add to cart" on the backpack', 'Look at the cart badge'],
      expected: ['The badge shows 1', 'The button says Remove'],
    },
  ],
};

describe('planner', () => {
  it('turns the accessibility tree into a plan in Markdown, and reads it back', async () => {
    const { model, prompts } = scriptedModel([{ answer: PLAN }]);
    const log = new MemoryRunLog();
    const result = await planPage(
      {
        name: 'inventory',
        url: 'https://www.saucedemo.com/inventory.html',
        snapshot: SNAPSHOT,
        seed: 'tests/seed.spec.ts',
      },
      { model: { model, label: 'mock' }, log },
    );
    expect(result.markdown).toContain('### 2. Add the backpack to the cart');
    expect(result.markdown).toContain('**Seed:** `tests/seed.spec.ts`');
    expect(JSON.stringify(prompts[0])).toContain('<accessibility-tree>');
    expect(parsePlan(result.markdown!)).toEqual(PLAN);
    expect(log.records[0]).toMatchObject({ agent: 'planner', source: 'model' });
  });

  it('gives no plan without a model, and says why', async () => {
    const result = await planPage({ name: 'x', url: 'https://example.test', snapshot: SNAPSHOT });
    expect(result.plan).toBeUndefined();
    expect(result.reason).toMatch(/needs a model/);
  });

  it('reads a plan written by hand in the same layout', () => {
    const md = renderPlan(PLAN, { url: 'https://www.saucedemo.com/inventory.html' }).replace(
      '- The badge shows 1',
      '* The badge shows 1',
    );
    expect(parsePlan(md).scenarios[1]?.expected).toEqual(['The badge shows 1', 'The button says Remove']);
  });
});

describe('generator', () => {
  const input = {
    scenario: PLAN.scenarios[1]!,
    file: 'tests/generated/add-backpack.spec.ts',
    url: 'https://www.saucedemo.com/inventory.html',
    examples: [{ path: 'tests/seed.spec.ts', code: "import { expect, test } from '../src/fixtures';" }],
  };
  const good =
    "import { expect, test } from '../../src/fixtures';\n\ntest('adds the backpack', async ({ page }) => { await expect(page).toHaveURL(/inventory/); });";

  it('returns the spec once it passes its check', async () => {
    const { model } = scriptedModel([{ answer: { code: good } }]);
    const checked: string[] = [];
    const result = await generateSpec(
      input,
      async (code) => {
        checked.push(code);
        return { ok: true };
      },
      { model: { model, label: 'mock' } },
    );
    expect(result).toMatchObject({ status: 'passed', attempts: 1, code: good });
    expect(checked).toEqual([good]);
  });

  it('sends the errors back once, then stops and reports', async () => {
    const script = scriptedModel([
      { answer: { code: `${good}\n// first` } },
      { answer: { code: `${good}\n// second` } },
    ]);
    const log = new MemoryRunLog();
    const result = await generateSpec(
      input,
      async () => ({ ok: false, errors: 'Error: locator.click: Timeout 5000ms exceeded' }),
      { model: { model: script.model, label: 'mock' }, log },
    );
    expect(result).toMatchObject({ status: 'failed', attempts: 2 });
    expect(JSON.stringify(script.prompts[1])).toContain('Timeout 5000ms exceeded');
    expect(JSON.stringify(script.prompts[1])).toContain('// first');
    expect(log.records[0]).toMatchObject({ agent: 'generator', output: { status: 'failed', attempts: 2 } });
  });

  it('strips a Markdown fence the model wrapped around the code', async () => {
    const { model } = scriptedModel([{ answer: { code: '```ts\n' + good + '\n```' } }]);
    const result = await generateSpec(input, async () => ({ ok: true }), { model: { model, label: 'mock' } });
    expect(result.code?.startsWith('import')).toBe(true);
    expect(result.code).not.toContain('```');
  });

  it('does nothing without a model', async () => {
    expect(await generateSpec(input, async () => ({ ok: true }))).toEqual({
      status: 'no-model',
      attempts: 0,
    });
  });
});

describe('repairSpec', () => {
  it('fixes the fixtures import depth for the spec folder', async () => {
    const { repairSpec } = await import('../src');
    expect(repairSpec("import { expect, test } from '../src/fixtures';", 'tests/generated/a.spec.ts')).toBe(
      "import { expect, test } from '../../src/fixtures';",
    );
    expect(repairSpec('import { test } from "../../../src/fixtures/index";', 'tests/a.spec.ts')).toBe(
      'import { test } from "../src/fixtures";',
    );
  });

  it('re-quotes titles that contain their own quote marks, and leaves good lines alone', async () => {
    const { repairSpec } = await import('../src');
    const code = [
      "    await test.step('click on the 'Sort products' combobox', async () => {",
      "  test('says \"hi\" and 'bye'', async ({ page }) => {",
      "  test.describe('Inventory', () => {",
      "    await page.getByRole('button', { name: 'Add to cart' }).click();",
    ].join('\n');
    expect(repairSpec(code, 'tests/generated/a.spec.ts').split('\n')).toEqual([
      '    await test.step("click on the \'Sort products\' combobox", async () => {',
      '  test(`says "hi" and \'bye\'`, async ({ page }) => {',
      "  test.describe('Inventory', () => {",
      "    await page.getByRole('button', { name: 'Add to cart' }).click();",
    ]);
  });

  it('turns the rejected attempt from the laptop into a file that parses', async () => {
    const { repairSpec } = await import('../src');
    const attempt =
      "import { expect, test } from '../src/fixtures';\n\n\ntest.describe('x', () => {\n  test('y', async ({ inventoryPage }) => {\n    await test.step('verify that the cart badge displays the number '1'', async () => {\n      await expect(inventoryPage.header.cartBadge).toHaveText('1');\n    });\n  });\n});";
    const fixed = repairSpec(attempt, 'tests/generated/main-happy-path.spec.ts');
    expect(fixed).toContain("from '../../src/fixtures'");
    expect(fixed).toContain(
      'await test.step("verify that the cart badge displays the number \'1\'", async () => {',
    );
    expect(fixed).not.toMatch(/\n\n\n/);
  });
});
