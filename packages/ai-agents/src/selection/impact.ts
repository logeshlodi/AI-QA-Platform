import fs from 'node:fs';
import path from 'node:path';
import { outcomesOf, type StoredRun } from '@aiqa/reporting-engine';
import { isSpec, reachableSpecs, reachedByUnitTest, type ImportGraph } from './graph';

/** test-impact.json: what reading imports cannot see. */
export interface ImpactMap {
  runEverything: string[];
  ignore: string[];
  covers: { source: string[]; specs: string[]; why: string }[];
}

export const EMPTY_IMPACT: ImpactMap = { runEverything: [], ignore: [], covers: [] };

export function readImpactMap(root: string): ImpactMap {
  const file = path.join(root, 'test-impact.json');
  if (!fs.existsSync(file)) return EMPTY_IMPACT;
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<ImpactMap>;
  return { runEverything: raw.runEverything ?? [], ignore: raw.ignore ?? [], covers: raw.covers ?? [] };
}

/** `**` any depth, `*` within one folder, `?` one character. Repository-relative, forward slashes. */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === '*' && glob[i + 1] === '*') {
      re += glob[i + 2] === '/' ? '(?:.*/)?' : '.*';
      i += glob[i + 2] === '/' ? 2 : 1;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}
const matchesAny = (file: string, globs: readonly string[]) => globs.some((g) => globToRegExp(g).test(file));

/** Why a spec was picked, strongest first. */
export type Reason =
  | { kind: 'changed'; file: string }
  | { kind: 'uses'; file: string; distance: number; via: string[] }
  | { kind: 'covers'; file: string; why: string }
  | { kind: 'shared'; file: string; via: string[] }
  | { kind: 'everything'; file: string }
  | { kind: 'model'; why: string };

/** What the run history says about one spec file. */
export interface SpecHistory {
  runs: number;
  failedRuns: number;
  flakyRuns: number;
  /** The spec's outcome in its latest run: failed if any test in it failed. */
  lastOutcome?: 'passed' | 'failed' | 'flaky';
  /** Average time all its tests took in one run, in milliseconds. */
  averageMs?: number;
}

export interface SelectedSpec {
  spec: string;
  score: number;
  reasons: Reason[];
  history?: SpecHistory;
}

export interface Selection {
  changed: string[];
  /** Changed files no spec and no unit test reaches: code without a test, which a reviewer should know. */
  uncovered: string[];
  /** Changed files only unit tests reach (they always run, so nothing to select). */
  unitTested: string[];
  ignored: string[];
  everything: boolean;
  selected: SelectedSpec[];
  /** Picked but cut by the time budget, highest score first. */
  overBudget: SelectedSpec[];
  /**
   * Specs that reach a changed file only through a shared hub (the fixtures file, a package's
   * barrel) without using anything from it. Not run unless `includeShared`: they load the code but
   * do not exercise it.
   */
  reachableOnly: SelectedSpec[];
  estimatedMs: number;
}

/** History suites and the package their spec paths are relative to. */
export const SUITE_PACKAGES: Record<string, string> = {
  ui: 'packages/playwright-framework',
  perf: 'packages/playwright-framework',
  api: 'packages/api-framework',
  data: 'packages/data-framework',
};

/** Per spec file (repository-relative): failures, flakes and time over the recorded runs. */
export function specHistory(runs: readonly StoredRun[]): Map<string, SpecHistory> {
  const out = new Map<string, SpecHistory>();
  const ordered = [...runs].sort((a, b) => a.run.startedAt.localeCompare(b.run.startedAt));
  const durations = new Map<string, number[]>();
  for (const stored of ordered) {
    const pkg = SUITE_PACKAGES[stored.run.suite];
    if (!pkg) continue;
    const perFile = new Map<string, { failed: boolean; flaky: boolean; ms: number }>();
    for (const o of outcomesOf(stored.results)) {
      if (o.outcome === 'skipped') continue;
      const file = `${pkg}/${o.file}`;
      const agg = perFile.get(file) ?? { failed: false, flaky: false, ms: 0 };
      agg.failed ||= o.outcome === 'failed';
      agg.flaky ||= o.outcome === 'flaky';
      perFile.set(file, agg);
    }
    for (const r of stored.results) {
      const file = `${pkg}/${r.file}`;
      const agg = perFile.get(file);
      if (agg) agg.ms += r.durationMs;
    }
    for (const [file, agg] of perFile) {
      const h = out.get(file) ?? { runs: 0, failedRuns: 0, flakyRuns: 0 };
      h.runs++;
      if (agg.failed) h.failedRuns++;
      if (agg.flaky) h.flakyRuns++;
      h.lastOutcome = agg.failed ? 'failed' : agg.flaky ? 'flaky' : 'passed';
      out.set(file, h);
      (durations.get(file) ?? durations.set(file, []).get(file)!).push(agg.ms);
    }
  }
  for (const [file, list] of durations) {
    const h = out.get(file)!;
    h.averageMs = Math.round(list.reduce((a, b) => a + b, 0) / list.length);
  }
  return out;
}

const BASE: Record<Reason['kind'], number> = {
  changed: 100,
  uses: 80,
  covers: 60,
  model: 45,
  shared: 25,
  everything: 20,
};

/**
 * Score: how directly the change reaches the spec, plus how risky the spec has been. Each part is
 * in the reasons, so a person can see why a spec ranks where it does.
 */
export function scoreOf(reasons: readonly Reason[], history?: SpecHistory): number {
  const reach = Math.max(
    ...reasons.map((r) => BASE[r.kind] - (r.kind === 'uses' ? Math.min(30, (r.distance - 1) * 10) : 0)),
  );
  if (!history || history.runs === 0) return reach;
  const failRate = history.failedRuns / history.runs;
  const flakyRate = history.flakyRuns / history.runs;
  const risk = failRate * 30 + flakyRate * 15 + (history.lastOutcome === 'failed' ? 20 : 0);
  return Math.round(reach + risk);
}

// Names every spec contains: finding them proves nothing.
const GENERIC = new Set(['test', 'expect', 'default', 'config', 'setup', 'env', 'page', 'Page']);

/** Names a changed file exports, and the fixture names they are injected as (CartPage -> cartPage). */
function exportedNames(root: string, file: string): string[] {
  const full = path.join(root, file);
  if (!/\.(m?ts|tsx)$/.test(file) || !fs.existsSync(full)) return [];
  const text = fs.readFileSync(full, 'utf8');
  const names = [
    ...text.matchAll(
      /export\s+(?:default\s+)?(?:abstract\s+)?(?:class|function|const|let|interface|type|enum)\s+(\w+)/g,
    ),
  ].map((m) => m[1]!);
  return [...new Set(names.flatMap((n) => [n, n[0]!.toLowerCase() + n.slice(1)]))].filter(
    (n) => !GENERIC.has(n),
  );
}

/**
 * The bodies of a fixtures file's auto fixtures (`name: [async (...) => {...}, { auto: true }]`):
 * these run in every test, so code they use affects every spec using the file.
 */
export function autoFixtureBodies(text: string): string[] {
  const bodies: string[] = [];
  for (const m of text.matchAll(/^\s*(\w+):\s*\[/gm)) {
    let depth = 0;
    let end = -1;
    for (let i = m.index + m[0].length - 1; i < text.length; i++) {
      const c = text[i];
      if (c === '[') depth++;
      else if (c === ']' && --depth === 0) {
        end = i;
        break;
      }
    }
    const body = end > 0 ? text.slice(m.index, end + 1) : '';
    if (/\bauto:\s*true\b/.test(body)) bodies.push(body);
  }
  return bodies;
}

export interface SelectOptions {
  root: string;
  graph: ImportGraph;
  impact?: ImpactMap;
  history?: Map<string, SpecHistory>;
  /** Stop adding specs once their estimated time passes this. Unknown durations count as 20 s. */
  budgetMs?: number;
  /** A file more than this many files import is a hub: reaching a spec through it alone is "shared". */
  hubSize?: number;
  /** Run the "shared" specs too. Default false. */
  includeShared?: boolean;
}

const UNKNOWN_MS = 20_000;

/**
 * Rules only: which specs a set of changed files can affect, ranked. Deterministic and explainable;
 * the model may add to it (see selectTests), never remove from it.
 */
export function selectByRules(changedFiles: readonly string[], options: SelectOptions): Selection {
  const impact = options.impact ?? EMPTY_IMPACT;
  const hubSize = options.hubSize ?? 15;
  const picked = new Map<string, Reason[]>();
  const add = (spec: string, reason: Reason) =>
    (picked.get(spec) ?? picked.set(spec, []).get(spec)!).push(reason);
  const changed = [...new Set(changedFiles.map((f) => f.replaceAll('\\', '/')))].sort();
  const ignored: string[] = [];
  const uncovered: string[] = [];
  const unitTested: string[] = [];
  let everything = false;
  const autoCache = new Map<string, string>();

  for (const file of changed) {
    if (matchesAny(file, impact.runEverything)) {
      everything = true;
      for (const spec of options.graph.specs) add(spec, { kind: 'everything', file });
      continue;
    }
    let reached = false;
    if (isSpec(file) && options.graph.specs.includes(file)) {
      add(file, { kind: 'changed', file });
      reached = true;
    }
    const isHub = (f: string) => (options.graph.dependents.get(f)?.size ?? 0) > hubSize;
    // Names a spec would use if this change matters to it: the changed file's exports and those of
    // every non-spec file that depends on it, stopping at hubs (cart.page -> checkout.flow: a spec
    // naming checkoutFlow is affected, whichever path the import search found first).
    let names: string[] | undefined;
    const upstreamNames = (): string[] => {
      if (names) return names;
      const seen = new Set([file]);
      const queue = [file];
      while (queue.length && seen.size < 60) {
        const f = queue.shift()!;
        for (const parent of options.graph.dependents.get(f) ?? [])
          if (!seen.has(parent) && !isSpec(parent) && !isHub(parent)) {
            seen.add(parent);
            queue.push(parent);
          }
      }
      names = [...new Set([...seen].flatMap((f) => exportedNames(options.root, f)))];
      return names;
    };
    for (const [spec, { distance, via }] of reachableSpecs(options.graph, file)) {
      if (distance === 0) continue;
      // Through a hub (a fixtures file or a barrel most specs import), a spec is affected only if
      // it uses what changed; otherwise it is "shared": selected, but ranked low.
      const hubs = via.slice(1, -1).filter(isHub);
      let uses = hubs.length === 0;
      if (!uses) {
        const mentions = (text: string) => upstreamNames().some((n) => new RegExp(`\\b${n}\\b`).test(text));
        // Used by an auto fixture in a hub on the way: it runs in every test, named or not.
        uses = hubs.some((hub) =>
          autoFixtureBodies(
            autoCache.get(hub) ??
              autoCache.set(hub, fs.readFileSync(path.join(options.root, hub), 'utf8')).get(hub)!,
          ).some(mentions),
        );
        uses ||= mentions(fs.readFileSync(path.join(options.root, spec), 'utf8'));
      }
      add(spec, uses ? { kind: 'uses', file, distance, via } : { kind: 'shared', file, via });
      reached = true;
    }
    for (const rule of impact.covers) {
      if (!matchesAny(file, rule.source)) continue;
      for (const spec of options.graph.specs.filter((s) => matchesAny(s, rule.specs)))
        add(spec, { kind: 'covers', file, why: rule.why });
      reached = true;
    }
    if (!reached) {
      if (matchesAny(file, impact.ignore)) ignored.push(file);
      else if (reachedByUnitTest(options.graph, file)) unitTested.push(file);
      else uncovered.push(file);
    }
  }

  const ranked: SelectedSpec[] = [...picked]
    .map(([spec, reasons]) => {
      const history = options.history?.get(spec);
      return { spec, reasons, history, score: scoreOf(reasons, history) };
    })
    .sort((a, b) => b.score - a.score || a.spec.localeCompare(b.spec));

  const selected: SelectedSpec[] = [];
  const overBudget: SelectedSpec[] = [];
  const reachableOnly: SelectedSpec[] = [];
  let estimatedMs = 0;
  for (const s of ranked) {
    if (!options.includeShared && s.reasons.every((r) => r.kind === 'shared')) {
      reachableOnly.push(s);
      continue;
    }
    const ms = s.history?.averageMs ?? UNKNOWN_MS;
    // The specs the change touches directly always run, budget or not.
    const must = s.reasons.some((r) => r.kind === 'changed');
    if (options.budgetMs !== undefined && !must && estimatedMs + ms > options.budgetMs) overBudget.push(s);
    else {
      selected.push(s);
      estimatedMs += ms;
    }
  }
  return {
    changed,
    uncovered,
    unitTested,
    ignored,
    everything,
    selected,
    overBudget,
    reachableOnly,
    estimatedMs,
  };
}
