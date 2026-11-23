import fs from 'node:fs';
import path from 'node:path';

/**
 * Which files each source file depends on, across the workspace: relative imports, workspace
 * packages (`@aiqa/shared` -> packages/shared/src/index.ts) and data files a file names
 * (`path.join(DATA, 'logins.csv')`). Paths are repository-relative with forward slashes.
 *
 * Built by reading the files, not by running TypeScript: fast (well under a second for this
 * repository) and good enough to answer "which specs can this change reach?". It errs towards
 * selecting too much (a barrel file re-exports everything), never too little.
 */
export interface ImportGraph {
  /** file -> the files it depends on */
  deps: Map<string, Set<string>>;
  /** file -> the files that depend on it */
  dependents: Map<string, Set<string>>;
  /** every Playwright spec in the workspace */
  specs: string[];
}

const SOURCE = /\.(m?ts|tsx|m?js)$/;
const DATA = /\.(csv|ya?ml|json|har|txt|html)$/;
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.aiqa',
  'test-results',
  'playwright-report',
  '.astro',
  '.next',
  'coverage',
  'allure-results',
]);
const IMPORT =
  /(?:import|export)\s[^'"`]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
const DATA_NAME = /['"`]([\w./-]+\.(?:csv|ya?ml|json|har|txt))['"`]/g;
export const isSpec = (file: string): boolean => /\.spec\.tsx?$/.test(file);
/** A unit test (Vitest): `pnpm test:unit` runs every one of them on every change. */
export const isUnitTest = (file: string): boolean => /\.test\.tsx?$/.test(file);

const posix = (p: string) => p.replaceAll('\\', '/');

function walk(root: string, dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.'))
        walk(root, path.join(dir, entry.name), out);
    } else if (SOURCE.test(entry.name) || DATA.test(entry.name)) {
      out.push(posix(path.join(dir, entry.name)));
    }
  }
}

/** `@aiqa/<name>` -> the entry file of that workspace package. */
function workspaceEntries(root: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const group of ['packages', 'apps']) {
    const dir = path.join(root, group);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const manifest = path.join(dir, name, 'package.json');
      if (!fs.existsSync(manifest)) continue;
      const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8')) as {
        name?: string;
        main?: string;
        types?: string;
      };
      if (!pkg.name) continue;
      const entry = pkg.types ?? pkg.main ?? './src/index.ts';
      entries.set(pkg.name, posix(path.join(group, name, entry)));
    }
  }
  return entries;
}

function resolveFile(base: string, known: Set<string>): string | undefined {
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    `${base}.js`,
    `${base}.mjs`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    // ESM-style specifiers name the compiled file: './x.js' is './x.ts' in source.
    base.replace(/\.m?js$/, '.ts'),
  ];
  return candidates.find((c) => known.has(c));
}

export function buildImportGraph(root: string, scan: readonly string[] = ['packages', 'apps']): ImportGraph {
  const files: string[] = [];
  for (const dir of scan) if (fs.existsSync(path.join(root, dir))) walk(root, dir, files);
  const known = new Set(files);
  const byBasename = new Map<string, string[]>();
  for (const f of files)
    if (DATA.test(f)) {
      const list = byBasename.get(path.posix.basename(f)) ?? [];
      list.push(f);
      byBasename.set(path.posix.basename(f), list);
    }
  const packages = workspaceEntries(root);
  const deps = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();
  const link = (from: string, to: string) => {
    if (from === to) return;
    (deps.get(from) ?? deps.set(from, new Set()).get(from)!).add(to);
    (dependents.get(to) ?? dependents.set(to, new Set()).get(to)!).add(from);
  };

  for (const file of files) {
    if (!SOURCE.test(file)) continue;
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const m of text.matchAll(IMPORT)) {
      const spec = m[1] ?? m[2] ?? m[3] ?? m[4];
      if (!spec) continue;
      let target: string | undefined;
      if (spec.startsWith('.')) {
        target = resolveFile(path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)), known);
      } else {
        const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]!;
        const entry = packages.get(name);
        if (entry) {
          const sub = spec.slice(name.length);
          target = sub
            ? (resolveFile(path.posix.join(path.posix.dirname(path.posix.dirname(entry)), sub), known) ??
              resolveFile(path.posix.join(path.posix.dirname(entry), sub), known))
            : resolveFile(entry.replace(/\.ts$/, ''), known);
        }
      }
      if (target) link(file, target);
    }
    // Data files named in the code: the nearest one with that name, in the same package if any.
    for (const m of text.matchAll(DATA_NAME)) {
      const name = path.posix.basename(m[1]!);
      const matches = byBasename.get(name);
      if (!matches) continue;
      const pkg = file.split('/').slice(0, 2).join('/');
      const local = matches.filter((f) => f.startsWith(`${pkg}/`));
      for (const f of local.length ? local : matches) link(file, f);
    }
  }
  return { deps, dependents, specs: files.filter(isSpec).sort() };
}

/** Whether a unit test reaches the file (or is the file), through the same graph. */
export function reachedByUnitTest(graph: ImportGraph, changed: string, maxDepth = 8): boolean {
  if (isUnitTest(changed)) return true;
  const seen = new Set([changed]);
  let frontier = [changed];
  for (let d = 0; d < maxDepth && frontier.length; d++) {
    const next: string[] = [];
    for (const f of frontier)
      for (const parent of graph.dependents.get(f) ?? []) {
        if (isUnitTest(parent)) return true;
        if (!seen.has(parent)) {
          seen.add(parent);
          next.push(parent);
        }
      }
    frontier = next;
  }
  return false;
}

/**
 * The specs a changed file can reach through the graph, each with its distance (0: the spec itself
 * changed; 1: it imports the changed file; and so on) and the chain that links them.
 */
export function reachableSpecs(
  graph: ImportGraph,
  changed: string,
  maxDepth = 8,
): Map<string, { distance: number; via: string[] }> {
  const found = new Map<string, { distance: number; via: string[] }>();
  const seen = new Set([changed]);
  let frontier: { file: string; via: string[] }[] = [{ file: changed, via: [changed] }];
  for (let distance = 0; distance <= maxDepth && frontier.length; distance++) {
    const next: typeof frontier = [];
    for (const { file, via } of frontier) {
      if (isSpec(file) && !found.has(file)) found.set(file, { distance, via });
      for (const parent of graph.dependents.get(file) ?? []) {
        if (seen.has(parent)) continue;
        seen.add(parent);
        next.push({ file: parent, via: [...via, parent] });
      }
    }
    frontier = next;
  }
  return found;
}
