import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { projectNameProblem, renderProject, writeProject } from '../src';

const paths = (kind: 'ui' | 'api' | 'both') => renderProject({ name: 'my-tests', kind }).map((f) => f.path);

describe('project templates', () => {
  it('a UI project has page objects, fixtures and a smoke spec, and no API suite', () => {
    expect(paths('ui')).toEqual([
      '.gitignore',
      'README.md',
      'package.json',
      'playwright.config.ts',
      'tests/ui/fixtures.ts',
      'tests/ui/pages/inventory.page.ts',
      'tests/ui/pages/login.page.ts',
      'tests/ui/smoke.spec.ts',
      'tsconfig.json',
    ]);
  });

  it('an API project has the API suite only; both has both, as two Playwright projects', () => {
    expect(paths('api')).toContain('tests/api/booking.spec.ts');
    expect(paths('api').some((p) => p.startsWith('tests/ui'))).toBe(false);
    const both = renderProject({ name: 'my-tests', kind: 'both' });
    const config = both.find((f) => f.path === 'playwright.config.ts')!.content;
    expect(config).toContain("name: 'ui'");
    expect(config).toContain("name: 'api'");
    // SauceDemo's ids are data-test; Playwright's default (data-testid) finds nothing there.
    expect(config).toContain("testIdAttribute: 'data-test'");
    // A local run must not stop to serve the report.
    expect(config).toContain("open: 'never'");
    expect(
      renderProject({ name: 'x', kind: 'api' }).find((f) => f.path === 'playwright.config.ts')!.content,
    ).not.toContain('devices');
  });

  it('pins the Playwright and TypeScript versions this repository runs', () => {
    const pkg = JSON.parse(
      renderProject({ name: 'my-tests', kind: 'ui' }).find((f) => f.path === 'package.json')!.content,
    );
    expect(pkg.name).toBe('my-tests');
    expect(pkg.devDependencies['@playwright/test']).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.devDependencies.typescript).toMatch(/^\d+\.\d+\.\d+$/);
    const readme = renderProject({ name: 'my-tests', kind: 'both', date: new Date('2026-11-23') }).find(
      (f) => f.path === 'README.md',
    )!.content;
    expect(readme).toContain('`both` template (2026-11-23)');
    expect(readme).not.toMatch(/\{\{\w+\}\}/);
  });

  it.each([
    ['My Tests', /lower-case/],
    ['-dash', /starting with/],
    ['', /needed/],
  ])('refuses the name %j', (name, problem) => {
    expect(projectNameProblem(name)).toMatch(problem);
    expect(() => renderProject({ name, kind: 'ui' })).toThrow();
  });

  it('writes into a new or empty folder, and not over anything without force', () => {
    const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'aiqa-tpl-')), 'proj');
    const files = renderProject({ name: 'proj', kind: 'ui' });
    writeProject(dir, files);
    expect(fs.existsSync(path.join(dir, 'tests/ui/pages/login.page.ts'))).toBe(true);
    expect(() => writeProject(dir, files)).toThrow(/not empty/);
    writeProject(dir, files, { force: true });
  });
});
