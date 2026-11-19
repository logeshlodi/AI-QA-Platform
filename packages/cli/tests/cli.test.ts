import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createRunRepository, type MetricTrend, type StoredRun } from '@aiqa/reporting-engine';
import {
  formatFiles,
  formatFlaky,
  formatPerf,
  formatHistory,
  kebab,
  loadRuns,
  makeData,
  pageElements,
  pascal,
  propertyName,
  renderPage,
  writeFiles,
} from '../src';

const SNAPSHOT = `
- heading "Swag Labs" [level=1]
- textbox "Username"
- textbox "Password"
- button "Login"
- button "Add to cart"
- button "Add to cart"
- link "Forgot your password?"
- paragraph: Some text
- button "1"
`;

const dirs: string[] = [];
const tempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiqa-cli-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('names', () => {
  it('turns accessible names into readable properties', () => {
    expect(propertyName('Forgot your password?', 'link')).toBe('forgotYourPasswordLink');
    expect(propertyName('Username', 'textbox')).toBe('usernameField');
    expect(propertyName('1', 'button')).toBe('el1Button');
  });
  it('turns a page name into a class and a file name', () => {
    expect(pascal('order history')).toBe('OrderHistory');
    expect(kebab('OrderHistory')).toBe('order-history');
  });
});

describe('pageElements', () => {
  it('keeps unique, named, actionable elements and skips duplicates and plain text', () => {
    expect(pageElements(SNAPSHOT).map((e) => e.property)).toEqual([
      'swagLabsHeading',
      'usernameField',
      'passwordField',
      'loginButton',
      'forgotYourPasswordLink',
      'el1Button',
    ]);
  });
});

describe('renderPage', () => {
  const files = renderPage({
    name: 'Login',
    site: 'saucedemo',
    urlPath: '/',
    target: 'saucedemo',
    ariaSnapshot: SNAPSHOT,
  });

  it('writes a page object and a spec in the framework layout', () => {
    expect(files.map((f) => f.path.replaceAll('\\', '/'))).toEqual([
      'src/pages/saucedemo/login.page.ts',
      'tests/generated/login.spec.ts',
    ]);
  });

  it('uses exact role locators with descriptions', () => {
    expect(files[0]!.content).toContain(
      `this.loginButton = page\n      .getByRole('button', { name: 'Login', exact: true })\n      .describe('Login button');`,
    );
    expect(files[0]!.content).toContain('export class LoginPage extends BasePage');
  });

  it('asserts the first heading in the starter spec', () => {
    expect(files[1]!.content).toContain('await expect(loginPage.swagLabsHeading).toBeVisible();');
  });

  it('escapes quotes in names', () => {
    const [page] = renderPage({
      name: 'x',
      site: 's',
      urlPath: '/',
      target: 'saucedemo',
      ariaSnapshot: '- button "Don\'t go"',
    });
    expect(page!.content).toContain("{ name: 'Don\\'t go', exact: true }");
  });

  it('still renders without a snapshot', () => {
    const [page, spec] = renderPage({
      name: 'order history',
      site: 'saucedemo',
      urlPath: '/orders.html',
      target: 'saucedemo',
    });
    expect(page!.content).toContain('No named elements were found');
    expect(spec!.content).toContain("await expect(page).toHaveURL(new RegExp('/orders\\\\.html'));");
  });
});

describe('formatFiles', () => {
  it('formats generated code with the repository Prettier settings', async () => {
    const files = renderPage({
      name: 'Login',
      site: 'saucedemo',
      urlPath: '/',
      target: 'saucedemo',
      ariaSnapshot: SNAPSHOT,
    });
    const root = path.resolve(__dirname, '..', '..', 'playwright-framework');
    const [page] = await formatFiles(root, files);
    expect(page!.content).toContain(
      "this.loginButton = page.getByRole('button', { name: 'Login', exact: true }).describe('Login button');",
    );
  });
});

describe('writeFiles', () => {
  it('refuses to overwrite without force', () => {
    const root = tempDir();
    const files = [{ path: 'a/b.ts', content: 'one' }];
    writeFiles(root, files);
    expect(() => writeFiles(root, [{ path: 'a/b.ts', content: 'two' }])).toThrow(/Not overwriting a\/b\.ts/);
    writeFiles(root, [{ path: 'a/b.ts', content: 'two' }], true);
    expect(fs.readFileSync(path.join(root, 'a/b.ts'), 'utf8')).toBe('two');
  });
});

const runOf = (suite: string, at: string, statuses: ('passed' | 'failed')[][]): StoredRun => ({
  run: { id: `${suite}-${at}`, suite, startedAt: at, finishedAt: at, environment: 'local' },
  results: statuses.flatMap((attempts, i) =>
    attempts.map((status, retry) => ({
      runId: `${suite}-${at}`,
      testId: `t${i}`,
      retry,
      title: `test ${i}`,
      file: 'tests/x.spec.ts',
      project: 'chromium',
      status,
      durationMs: 10,
    })),
  ),
});

describe('history and flaky', () => {
  it('reads runs from a history folder and prints them newest first', () => {
    const dir = tempDir();
    // Same factory the reporter uses, so the test reads whichever store this Node version writes.
    const repo = createRunRepository(dir);
    repo.saveRun(runOf('api', '2026-11-19T10:00:00.000Z', [['passed']]));
    repo.saveRun(runOf('ui', '2026-11-19T11:00:00.000Z', [['passed'], ['failed', 'passed']]));
    repo.close();
    const lines = formatHistory(loadRuns(dir)).split('\n');
    expect(lines[1]).toMatch(/^2026-11-19 11:00\s+ui\s+2\s+0\s+1\s+100%$/);
    expect(lines[2]).toMatch(/api/);
    expect(formatHistory(loadRuns(dir), 'api').split('\n')).toHaveLength(2);
  });

  it('says so when there is no history', () => {
    expect(formatHistory([])).toMatch(/No runs recorded/);
  });

  it('lists flaky tests with their numbers', () => {
    const out = formatFlaky([runOf('ui', '2026-11-19T11:00:00.000Z', [['failed', 'passed']])]);
    expect(out).toContain('1.00  test 0  [chromium]');
    expect(out).toContain('1 passed on retry');
  });
});

describe('perf', () => {
  const trend = (verdict: MetricTrend['verdict'], latest: number, baseline?: number): MetricTrend => ({
    testId: 't',
    title: 'the login page paints fast',
    file: 'tests/performance/web-vitals.spec.ts',
    project: 'perf',
    metric: 'lcp_ms',
    latest,
    baseline,
    change: baseline === undefined ? undefined : (latest - baseline) / baseline,
    verdict,
    values: [],
  });

  it('shows what changed and hides steady metrics unless asked', () => {
    const trends = [trend('regressed', 600, 400), trend('steady', 410, 400)];
    const out = formatPerf(trends);
    expect(out).toContain('REGRESSED the login page paints fast  [perf]');
    expect(out).toContain('lcp_ms: 600 ms, usual 400 ms (+50%)');
    expect(out).toContain('1 steady metric (--all to list them)');
    expect(formatPerf(trends, true)).toContain('steady    the login page');
  });

  it('says so when everything is steady, or nothing was recorded', () => {
    expect(formatPerf([trend('steady', 410, 400)])).toBe(
      'All 1 metrics are steady (within 20% of their median).',
    );
    expect(formatPerf([])).toMatch(/No performance metrics recorded/);
  });
});

describe('makeData', () => {
  it('is seed-stable and sized by count', () => {
    expect(makeData('customer', 3, 9)).toHaveLength(3);
    expect(makeData('order', 2, 9)).toEqual(makeData('order', 2, 9));
  });
});
