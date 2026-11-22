import { rankA11yFindings } from '../a11y/agent';
import { planApiTests } from '../api/agent';
import { edgeCaseData, type DataEntity } from '../data/agent';
import { runEval, type EvalReport } from '../eval';
import { diagnoseFlaky } from '../flaky/agent';
import { reviewHeals } from '../healing/agent';
import type { RunLog } from '../log';
import type { ModelChoice } from '../model';
import { planPage } from '../planner/agent';
import { reportRun } from '../reporter/agent';
import { runTriageEval } from '../triage/eval';
import { A11Y_CASES, FLAKY_CASES, HEAL_CASES, PLANNER_SNAPSHOTS, REPORTER_CASES } from './cases';

export interface EvalContext {
  model: ModelChoice;
  log?: RunLog;
  timeoutMs?: number;
  /** The order service's OpenAPI document, for the API tester. */
  openApi?: unknown;
}

export interface AgentEval {
  agent: string;
  /** Share of cases that must pass. */
  gate: number;
  /** What it measures, in one line. */
  measures: string;
  /** Rough number of model calls, so a run on a CPU can be planned. */
  modelCalls: number;
  run(ctx: EvalContext): Promise<EvalReport<string>>;
}

const pass = (ok: boolean) => (ok ? 'pass' : 'fail');
const cases = <T>(items: T[], id: (t: T, i: number) => string) =>
  items.map((t, i) => ({ id: id(t, i), input: t, expected: 'pass' as string }));

/** Quoted names in a plan's steps ("Add to cart", 'Login') that do not appear in the accessibility tree. */
export function namesNotOnPage(steps: string[], snapshot: string): string[] {
  const names = steps.flatMap((s) => [...s.matchAll(/["'“‘]([^"'”’]{2,60})["'”’]/g)].map((m) => m[1]!));
  return names.filter((n) => !snapshot.toLowerCase().includes(n.toLowerCase()));
}

/**
 * The evals of every agent that needs only a model. The generator's needs a browser and the demo
 * site, so `aiqa agents eval generator` runs it from the CLI.
 */
export const AGENT_EVALS: AgentEval[] = [
  {
    agent: 'triage',
    gate: 0.8,
    measures:
      '30 recorded failures labelled product, test, flaky or environment (rules first, model for the rest)',
    modelCalls: 7,
    run: (ctx) => runTriageEval({ model: ctx.model, log: ctx.log, timeoutMs: ctx.timeoutMs }),
  },
  {
    agent: 'flaky',
    gate: 0.75,
    measures: 'the likely cause of 8 flaky tests from their errors',
    modelCalls: 8,
    run: (ctx) =>
      runEval(
        FLAKY_CASES.map((c) => ({ id: c.id, input: c.input, expected: c.expected as string })),
        async (input) => {
          const d = await diagnoseFlaky(input, ctx);
          return { label: d.cause, source: d.source };
        },
      ),
  },
  {
    agent: 'accessibility',
    gate: 0.8,
    measures: 'priority of 10 axe findings by what users cannot do (one call for all)',
    modelCalls: 1,
    run: async (ctx) => {
      const ranked = await rankA11yFindings(
        A11Y_CASES.map((c) => c.finding),
        ctx,
      );
      return runEval(
        A11Y_CASES.map((c) => ({ id: c.finding.id, input: c.finding.id, expected: c.expected as string })),
        async (id) => {
          const r = ranked.find((x) => x.id === id)!;
          return { label: r.priority, source: r.source };
        },
      );
    },
  },
  {
    agent: 'run-reporter',
    gate: 0.8,
    measures: '5 run summaries whose every number is in the facts and that name every failure',
    modelCalls: 5,
    run: (ctx) =>
      runEval(
        cases(REPORTER_CASES, (c) => c.id),
        async (c) => {
          const report = await reportRun(c.facts, ctx);
          return { label: pass(report.source === 'model'), source: report.source };
        },
      ),
  },
  {
    agent: 'test-data',
    gate: 0.8,
    measures: 'share of model-proposed edge-case records that pass their schema (product and customer)',
    modelCalls: 2,
    run: async (ctx) => {
      const outcomes: { id: string; input: boolean; expected: string }[] = [];
      for (const entity of ['product', 'customer'] as DataEntity[]) {
        const result = await edgeCaseData(entity, ctx);
        result.records
          .filter((r) => r.source === 'model')
          .forEach((_, i) => outcomes.push({ id: `${entity}-${i + 1}`, input: true, expected: 'pass' }));
        result.rejected.forEach((r, i) =>
          outcomes.push({ id: `${entity}-rejected-${i + 1} (${r.problem})`, input: false, expected: 'pass' }),
        );
        if (result.modelProposed === 0)
          outcomes.push({ id: `${entity}-none-proposed`, input: false, expected: 'pass' });
      }
      return runEval(outcomes, async (ok) => ({ label: pass(ok), source: 'model' }));
    },
  },
  {
    agent: 'api-tester',
    gate: 0.8,
    measures:
      'share of model-proposed cases the OpenAPI document allows, plus one per operation the model missed (counted as a fail)',
    modelCalls: 4,
    run: async (ctx) => {
      if (!ctx.openApi) throw new Error('The API tester eval needs the OpenAPI document.');
      const plan = await planApiTests(ctx.openApi, ctx);
      const outcomes = [
        ...plan.cases
          .filter((c) => c.source === 'model')
          .map((c) => ({ id: c.name, input: true, expected: 'pass' })),
        ...plan.rejected.map((r) => ({
          id: `${r.case.name} (${r.problem})`,
          input: false,
          expected: 'pass',
        })),
        ...plan.uncoveredByModel.map((op) => ({ id: `${op} not covered`, input: false, expected: 'pass' })),
      ];
      return runEval(outcomes, async (ok) => ({ label: pass(ok), source: 'model' }));
    },
  },
  {
    agent: 'planner',
    gate: 0.8,
    measures: 'plans for 2 SauceDemo pages that name only elements on the page',
    modelCalls: 2,
    run: (ctx) =>
      runEval(
        cases(PLANNER_SNAPSHOTS, (s) => s.id),
        async (s) => {
          const result = await planPage({ name: s.id, url: s.url, snapshot: s.snapshot }, ctx);
          if (!result.plan) return { label: 'fail', source: 'none' };
          const steps = result.plan.scenarios.flatMap((x) => x.steps);
          const missing = namesNotOnPage(steps, s.snapshot);
          const named = steps.join(' ').match(/["'“‘][^"'”’]{2,60}["'”’]/g)?.length ?? 0;
          return { label: pass(named > 0 && missing.length / named <= 0.2), source: 'model' };
        },
      ),
  },
  {
    agent: 'healing-review',
    gate: 0.8,
    measures: 'pull-request descriptions for 3 healed locators that name the locator and its new form',
    modelCalls: 3,
    run: (ctx) =>
      runEval(
        cases(HEAL_CASES, (e) => e.locatorKey),
        async (event) => {
          const file = `src/pages/${event.locatorKey.split('.')[0]!.toLowerCase()}.page.ts`;
          const source = {
            path: file,
            text: `export const x = (page: any) => page.${event.failedSelector};\n`,
          };
          const [review] = await reviewHeals([event], {
            root: '.',
            sources: [source],
            model: ctx.model,
            log: ctx.log,
            timeoutMs: ctx.timeoutMs,
          });
          const text = `${review?.title ?? ''} ${review?.body ?? ''}`;
          const field = event.locatorKey
            .split('.')[1]!
            .replace(/([A-Z])/g, ' $1')
            .toLowerCase();
          const mentions =
            text.includes(event.locatorKey) ||
            text.toLowerCase().includes(field) ||
            text.includes(event.suggestion!.replace(/^page\./, ''));
          return { label: pass(review?.source === 'model' && mentions), source: review?.source ?? 'none' };
        },
      ),
  },
];
