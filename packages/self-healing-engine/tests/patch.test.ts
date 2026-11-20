import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyLocatorPatch,
  proposeLocatorPatch,
  readPatchableSources,
  type HealEvent,
  type SourceFile,
} from '../src';

const event: HealEvent = {
  locatorKey: 'PayPage.payButton',
  testId: 't',
  failedSelector: "locator('#btn-1001')",
  healedSelector: 'body > main > form > button',
  suggestion: "page.getByRole('button', { name: 'Pay now' })",
  strategy: 'role',
  score: 0.93,
  outcome: 'healed',
  createdAt: '2026-11-20T00:00:00Z',
};

const PAGE = [
  "import type { Page } from '@playwright/test';",
  'export class PayPage {',
  '  constructor(private readonly page: Page) {}',
  "  readonly payButton = () => this.page.locator('#btn-1001');",
  '}',
].join('\n');

const page = (text = PAGE, file = 'src/pages/pay.page.ts'): SourceFile => ({ path: file, text });

describe('proposeLocatorPatch', () => {
  it('replaces the one place the old locator is defined with the suggested one', () => {
    const proposal = proposeLocatorPatch(event, [page()]);
    expect(proposal.status).toBe('ready');
    if (proposal.status !== 'ready') return;
    expect(proposal.patch).toMatchObject({ file: 'src/pages/pay.page.ts', line: 4 });
    expect(proposal.patch.after).toBe(
      "  readonly payButton = () => this.page.getByRole('button', { name: 'Pay now' });",
    );
    expect(proposal.diff).toContain("-  readonly payButton = () => this.page.locator('#btn-1001');");
  });

  it('finds the locator whichever quotes the source uses', () => {
    const proposal = proposeLocatorPatch(event, [page(PAGE.replace("'#btn-1001'", '"#btn-1001"'))]);
    expect(proposal.status).toBe('ready');
  });

  it('never patches a spec or an assertion', () => {
    const spec = page("await expect(page.locator('#btn-1001')).toBeVisible();", 'tests/pay.spec.ts');
    expect(proposeLocatorPatch(event, [spec])).toMatchObject({
      status: 'refused',
      reason: expect.stringMatching(/not found/),
    });
    const assertion = page("  check = () => expect(this.page.locator('#btn-1001')).toBeVisible();");
    expect(proposeLocatorPatch(event, [assertion])).toMatchObject({
      reason: expect.stringMatching(/assertion/),
    });
  });

  it('refuses when the locator appears in more than one place', () => {
    const proposal = proposeLocatorPatch(event, [page(), page(PAGE, 'src/components/pay.component.ts')]);
    expect(proposal).toMatchObject({ status: 'refused', reason: expect.stringMatching(/2 times/) });
  });

  it('refuses events the engine refused, and events without a suggestion', () => {
    expect(proposeLocatorPatch({ ...event, outcome: 'refused' }, [page()]).status).toBe('refused');
    expect(proposeLocatorPatch({ ...event, suggestion: undefined }, [page()]).status).toBe('refused');
  });
});

describe('applyLocatorPatch', () => {
  const setup = (eol: string) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiqa-patch-'));
    fs.mkdirSync(path.join(root, 'src', 'pages'), { recursive: true });
    fs.mkdirSync(path.join(root, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'pages', 'pay.page.ts'), PAGE.split('\n').join(eol));
    fs.writeFileSync(path.join(root, 'tests', 'pay.spec.ts'), "page.locator('#btn-1001')");
    return root;
  };

  it.each([
    ['LF', '\n'],
    ['CRLF', '\r\n'],
  ])('reads only patchable files and writes the patch, keeping %s line endings', (_name, eol) => {
    const root = setup(eol);
    const sources = readPatchableSources(root);
    expect(sources.map((s) => s.path)).toEqual(['src/pages/pay.page.ts']);
    const proposal = proposeLocatorPatch(event, sources);
    if (proposal.status !== 'ready') throw new Error(proposal.reason);
    applyLocatorPatch(root, proposal.patch);
    const text = fs.readFileSync(path.join(root, 'src', 'pages', 'pay.page.ts'), 'utf8');
    expect(text).toContain("this.page.getByRole('button', { name: 'Pay now' })");
    expect(text.split(eol)).toHaveLength(5);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('refuses a patch whose line changed since it was proposed', () => {
    const root = setup('\n');
    const proposal = proposeLocatorPatch(event, readPatchableSources(root));
    if (proposal.status !== 'ready') throw new Error(proposal.reason);
    fs.writeFileSync(path.join(root, 'src', 'pages', 'pay.page.ts'), PAGE.replace('payButton', 'pay'));
    expect(() => applyLocatorPatch(root, proposal.patch)).toThrow(/changed since/);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
