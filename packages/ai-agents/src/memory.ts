import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { errorSignature, TRIAGE_LABELS, type TriageLabel } from './triage/context';

/** Repository root: packages/ai-agents/src -> ../../.. */
export const DECISIONS_FILE = path.resolve(__dirname, '..', '..', '..', '.aiqa', 'agents', 'decisions.jsonl');

/**
 * What a person decided about an agent's output. Agents read these back before answering, so a
 * correction is made once: the same failure is labelled the way the person said, a declined
 * healing patch is not offered again, and similar cases reach the model as examples.
 *
 * Only people write here (`aiqa agents feedback`, the heal-review prompt). An agent's own answers
 * are never stored as decisions: memory that learns from itself drifts.
 */
export const decisionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('triage'),
    at: z.string(),
    by: z.string().min(1).max(60),
    testId: z.string().min(1),
    title: z.string(),
    /** errorSignature() of the failure: numbers, ids and quoted values blanked out. */
    signature: z.string(),
    label: z.enum(TRIAGE_LABELS),
    /** What the agent had said, when the person was correcting it. */
    agentLabel: z.enum([...TRIAGE_LABELS, 'unknown']).optional(),
    note: z.string().max(400).optional(),
  }),
  z.object({
    kind: z.literal('heal'),
    at: z.string(),
    by: z.string().min(1).max(60),
    locatorKey: z.string().min(1),
    failedSelector: z.string(),
    suggestion: z.string(),
    verdict: z.enum(['approved', 'declined']),
    note: z.string().max(400).optional(),
  }),
]);
export type Decision = z.infer<typeof decisionSchema>;
export type TriageDecision = Extract<Decision, { kind: 'triage' }>;
export type HealDecision = Extract<Decision, { kind: 'heal' }>;

export interface DecisionStore {
  record(decision: Decision): void;
  /** Oldest first. */
  all(): Decision[];
}

/** One JSON line per decision, append-only. Lines that fail the schema are skipped, not trusted. */
export class JsonlDecisionStore implements DecisionStore {
  constructor(private readonly file = DECISIONS_FILE) {}

  record(decision: Decision): void {
    const valid = decisionSchema.parse(decision);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.appendFileSync(this.file, JSON.stringify(valid) + '\n');
  }

  all(): Decision[] {
    if (!fs.existsSync(this.file)) return [];
    const out: Decision[] = [];
    for (const line of fs.readFileSync(this.file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const parsed = decisionSchema.safeParse(JSON.parse(line));
        if (parsed.success) out.push(parsed.data);
      } catch {
        // a torn line from an interrupted write
      }
    }
    return out;
  }
}

export class MemoryDecisionStore implements DecisionStore {
  readonly decisions: Decision[] = [];
  record(decision: Decision): void {
    this.decisions.push(decisionSchema.parse(decision));
  }
  all(): Decision[] {
    return [...this.decisions];
  }
}

export interface TriageRecall {
  /** A person already labelled this test failing this way. The latest such decision wins. */
  exact?: TriageDecision;
  /** Other tests a person labelled, failing with the same error signature: newest first, at most 3. */
  similar: TriageDecision[];
}

/** What people decided before about this failure, or failures that read the same. */
export function recallTriage(
  store: DecisionStore | undefined,
  failure: { testId: string; errorMessage: string },
): TriageRecall {
  if (!store) return { similar: [] };
  const signature = errorSignature(failure.errorMessage);
  const triage = store.all().filter((d): d is TriageDecision => d.kind === 'triage');
  const sameSignature = triage.filter((d) => d.signature === signature);
  const exact = sameSignature.filter((d) => d.testId === failure.testId).at(-1);
  const similar = sameSignature
    .filter((d) => d.testId !== failure.testId)
    .reverse()
    // One example per test: the latest decision about it.
    .filter((d, i, list) => list.findIndex((e) => e.testId === d.testId) === i)
    .slice(0, 3);
  return { exact, similar };
}

/** The latest decision a person made about this exact locator fix, if any. */
export function recallHeal(
  store: DecisionStore | undefined,
  fix: { locatorKey: string; suggestion: string },
): HealDecision | undefined {
  if (!store) return undefined;
  return store
    .all()
    .filter(
      (d): d is HealDecision =>
        d.kind === 'heal' && d.locatorKey === fix.locatorKey && d.suggestion === fix.suggestion,
    )
    .at(-1);
}

/** Builds a triage decision from a failure and a person's label. */
export function triageDecision(input: {
  testId: string;
  title: string;
  errorMessage: string;
  label: TriageLabel;
  agentLabel?: TriageLabel | 'unknown';
  by: string;
  note?: string;
  at?: string;
}): TriageDecision {
  return {
    kind: 'triage',
    at: input.at ?? new Date().toISOString(),
    by: input.by,
    testId: input.testId,
    title: input.title,
    signature: errorSignature(input.errorMessage),
    label: input.label,
    agentLabel: input.agentLabel,
    note: input.note,
  };
}
