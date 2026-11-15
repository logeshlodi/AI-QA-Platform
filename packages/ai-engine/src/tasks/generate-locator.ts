import { z } from 'zod';
import { completeJson } from '../json';
import { prompts } from '../prompts';
import type { LlmProvider } from '../provider';

/** One element from an aria snapshot that getByRole can address. */
export interface AriaCandidate {
  role: string;
  name: string;
}

export interface LocatorSuggestion extends AriaCandidate {
  /** Ready-to-paste Playwright code. */
  code: string;
  source: 'rules' | 'model';
}

// Roles that carry text rather than identity; a locator by role and name would not be stable for them.
const SKIPPED_ROLES = new Set(['text', 'paragraph', 'generic']);
const LINE = /^\s*-\s+([a-z]+)\s+"((?:[^"\\]|\\.)*)"/;

/**
 * Lists the elements of an aria snapshot (the YAML that `locator.ariaSnapshot()` returns)
 * that have a role and an accessible name, and whose role-and-name pair is unique on the page.
 * Duplicates are left out on purpose: a locator that matches two elements is not a locator.
 */
export function parseAriaSnapshot(snapshot: string): AriaCandidate[] {
  const seen = new Map<string, { candidate: AriaCandidate; count: number }>();
  for (const line of snapshot.split('\n')) {
    const match = LINE.exec(line);
    if (!match) continue;
    const role = match[1] as string;
    const name = (match[2] as string).replace(/\\(.)/g, '$1');
    if (SKIPPED_ROLES.has(role) || name.trim() === '') continue;
    const key = `${role}\u0000${name}`;
    const entry = seen.get(key);
    if (entry) entry.count += 1;
    else seen.set(key, { candidate: { role, name }, count: 1 });
  }
  return [...seen.values()].filter((e) => e.count === 1).map((e) => e.candidate);
}

export const locatorCode = ({ role, name }: AriaCandidate): string =>
  `page.getByRole(${JSON.stringify(role)}, { name: ${JSON.stringify(name)}, exact: true })`;

const words = (text: string): string[] => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

/** Rule: exactly one candidate whose role and every word of its name appear in the description. */
function matchByRules(candidates: AriaCandidate[], description: string): AriaCandidate | undefined {
  const wanted = new Set(words(description));
  const hits = candidates.filter(
    (c) => wanted.has(c.role) && words(c.name).length > 0 && words(c.name).every((w) => wanted.has(w)),
  );
  return hits.length === 1 ? hits[0] : undefined;
}

const answerSchema = z.object({ index: z.number().int() });

/**
 * Suggests a getByRole locator for the element a person describes ("the login button").
 * Rules first; the model is asked only when rules find no single match, and it can only
 * choose from the candidates parsed out of the snapshot. It can never invent a selector.
 * Returns undefined when nothing fits, which the caller must treat as "write it by hand".
 */
export async function generateLocator(
  provider: LlmProvider,
  ariaSnapshot: string,
  description: string,
): Promise<LocatorSuggestion | undefined> {
  const candidates = parseAriaSnapshot(ariaSnapshot);
  if (candidates.length === 0) return undefined;

  const byRules = matchByRules(candidates, description);
  if (byRules) return { ...byRules, code: locatorCode(byRules), source: 'rules' };

  if (!(await provider.isAvailable())) return undefined;
  const lines = candidates.map((c) => `${c.role} "${c.name}"`);
  const answer = await completeJson(
    provider,
    { system: prompts.generateLocator.system, prompt: prompts.generateLocator.user(description, lines) },
    answerSchema,
  );
  const picked = answer ? candidates[answer.index] : undefined;
  return picked ? { ...picked, code: locatorCode(picked), source: 'model' } : undefined;
}
