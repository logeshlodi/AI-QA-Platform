import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

/**
 * Starter projects for `aiqa new project`: standalone (npm, no workspace), on this platform's
 * patterns, with the same Playwright and TypeScript versions this repository runs.
 */
export type ProjectKind = 'ui' | 'api' | 'both';
export const PROJECT_KINDS: readonly ProjectKind[] = ['ui', 'api', 'both'];

export interface ProjectFile {
  /** Relative to the project folder, forward slashes. */
  path: string;
  content: string;
}

const FILES = path.resolve(__dirname, '..', 'files');
const requireHere = createRequire(__filename);
const versionOf = (pkg: string) => (requireHere(`${pkg}/package.json`) as { version: string }).version;

const LAYERS: Record<ProjectKind, string[]> = {
  ui: ['base', 'ui'],
  api: ['base', 'api'],
  both: ['base', 'ui', 'api'],
};

/** npm's rules for an unscoped package name, which is also the folder name. */
export function projectNameProblem(name: string): string | undefined {
  if (!name) return 'a name is needed';
  if (name.length > 214) return 'at most 214 characters';
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(name))
    return 'lower-case letters, digits, ".", "_" and "-" only, starting with a letter or digit';
  return undefined;
}

function walk(dir: string, prefix = ''): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`],
    );
}

function playwrightConfig(kind: ProjectKind): string {
  const ui = `    {
      name: 'ui',
      testDir: './tests/ui',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.UI_BASE_URL ?? 'https://www.saucedemo.com',
        testIdAttribute: 'data-test', // SauceDemo marks its elements with data-test
      },
    },`;
  const api = `    {
      name: 'api',
      testDir: './tests/api',
      use: { baseURL: process.env.API_BASE_URL ?? 'https://restful-booker.herokuapp.com' },
    },`;
  const projects = [kind !== 'api' ? ui : '', kind !== 'ui' ? api : ''].filter(Boolean).join('\n');
  return `import { defineConfig${kind === 'api' ? '' : ', devices'} } from '@playwright/test';

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
${projects}
  ],
});
`;
}

const SUITES: Record<ProjectKind, string> = {
  ui: '`tests/ui`: SauceDemo sign-in and cart, with page objects in `tests/ui/pages` and fixtures in `tests/ui/fixtures.ts`. Point it elsewhere with `UI_BASE_URL`.',
  api: '`tests/api`: Restful-Booker, read-only smoke checks on status codes and response shapes. Point it elsewhere with `API_BASE_URL`.',
  both: '',
};

export function renderProject(options: { name: string; kind: ProjectKind; date?: Date }): ProjectFile[] {
  const problem = projectNameProblem(options.name);
  if (problem) throw new Error(`Project name "${options.name}": ${problem}.`);
  const values: Record<string, string> = {
    name: options.name,
    kind: options.kind,
    date: (options.date ?? new Date()).toISOString().slice(0, 10),
    playwrightVersion: versionOf('@playwright/test'),
    typescriptVersion: versionOf('typescript'),
    suites:
      options.kind === 'both'
        ? `Two suites, two Playwright projects:\n\n- ${SUITES.ui}\n- ${SUITES.api}`
        : `One suite: ${SUITES[options.kind]}`,
  };
  const files = new Map<string, string>();
  for (const layer of LAYERS[options.kind]) {
    for (const rel of walk(path.join(FILES, layer))) {
      const raw = fs.readFileSync(path.join(FILES, layer, rel), 'utf8');
      const target = rel === 'gitignore' ? '.gitignore' : rel.replace(/\.tpl$/, '');
      const content = rel.endsWith('.tpl')
        ? raw.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? '')
        : raw;
      files.set(target, content);
    }
  }
  files.set('playwright.config.ts', playwrightConfig(options.kind));
  return [...files].map(([p, content]) => ({ path: p, content })).sort((a, b) => (a.path < b.path ? -1 : 1)); // byte order: the same on every machine
}

/** Writes the files into `dir`, which must not exist or be empty (unless `force`). */
export function writeProject(dir: string, files: ProjectFile[], options: { force?: boolean } = {}): void {
  if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0 && !options.force)
    throw new Error(`${dir} is not empty. Choose another folder, or pass --force to write into it.`);
  for (const f of files) {
    const target = path.join(dir, ...f.path.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, f.content);
  }
}
