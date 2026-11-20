import { runEval, type EvalReport } from '../eval';
import type { RunLog } from '../log';
import type { ModelChoice } from '../model';
import { triage } from './agent';
import { TRIAGE_CASES } from './cases';
import type { TriageLabel } from './context';

export interface TriageEvalOptions {
  model?: ModelChoice;
  /** Measure the model alone, with the rules switched off. */
  skipRules?: boolean;
  log?: RunLog;
  /** Run only these case ids. */
  only?: string[];
}

/** The Triage agent against its 30 labelled failures. Sprint 9's gate: 80% or better with a model. */
export function runTriageEval(options: TriageEvalOptions = {}): Promise<EvalReport<TriageLabel>> {
  const cases = options.only ? TRIAGE_CASES.filter((c) => options.only!.includes(c.id)) : TRIAGE_CASES;
  return runEval(cases, async (ctx) => {
    const verdict = await triage(ctx, {
      model: options.model,
      skipRules: options.skipRules,
      log: options.log,
    });
    return { label: verdict.label, source: verdict.source };
  });
}

export const TRIAGE_GATE = 0.8;
