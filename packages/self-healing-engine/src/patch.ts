import fs from 'node:fs';
import path from 'node:path';
import type { HealEvent } from './types';

/** A one-line change to a locator in a page object, reviewable as a diff. */
export interface LocatorPatch {
  locatorKey: string;
  /** Path relative to the root it was found under, with forward slashes. */
  file: string;
  /** 1-based. */
  line: number;
  before: string;
  after: string;
}

export type PatchProposal =
  { status: 'ready'; patch: LocatorPatch; diff: string } | { status: 'refused'; reason: string };

export interface SourceFile {
  /** Relative to the root, forward slashes. */
  path: string;
  text: string;
}

/**
 * Locators live in page objects, components and flows, and in the mobile framework's screen
 * objects. Specs and assertions are never patched.
 */
export const PATCHABLE = /(^|\/)src\/(pages|components|flows|screens)\/.+\.ts$/;

const swapQuotes = (s: string) => s.replace(/['"]/g, (q) => (q === "'" ? '"' : "'"));

/**
 * Turns a healed event into a patch, or refuses with the reason. Refuses unless the old locator
 * appears exactly once, in a page object, component or flow, on a line without an assertion.
 * Nothing is written here: `applyLocatorPatch` does that, after a person approves.
 */
export function proposeLocatorPatch(event: HealEvent, sources: readonly SourceFile[]): PatchProposal {
  if (event.outcome !== 'healed') {
    return { status: 'refused', reason: 'The engine refused this heal itself; the locator needs a person.' };
  }
  if (!event.suggestion)
    return { status: 'refused', reason: 'The event has no suggested locator to patch in.' };

  // String(locator) reads e.g. "locator('#btn-1001')"; in source it is "page.locator('#btn-1001')".
  const needles = [`.${event.failedSelector}`, `.${swapQuotes(event.failedSelector)}`];
  const replacement = `.${event.suggestion.replace(/^page\./, '')}`;

  const hits: { file: string; line: number; text: string; needle: string }[] = [];
  for (const source of sources) {
    if (!PATCHABLE.test(source.path) || source.path.endsWith('.spec.ts')) continue;
    source.text.split(/\r?\n/).forEach((text, i) => {
      const needle = needles.find((n) => text.includes(n));
      if (needle) hits.push({ file: source.path, line: i + 1, text, needle });
    });
  }
  const usable = hits.filter((h) => !/\bexpect\s*\(/.test(h.text));
  if (usable.length === 0) {
    return {
      status: 'refused',
      reason: hits.length
        ? 'The old locator only appears on an assertion line; assertions are never patched.'
        : `"${event.failedSelector}" was not found in any page object, component or flow.`,
    };
  }
  if (usable.length > 1) {
    const where = usable.map((h) => `${h.file}:${h.line}`).join(', ');
    return {
      status: 'refused',
      reason: `The old locator appears ${usable.length} times (${where}); patch by hand.`,
    };
  }
  const hit = usable[0]!;
  const after = hit.text.replace(hit.needle, replacement);
  const patch: LocatorPatch = {
    locatorKey: event.locatorKey,
    file: hit.file,
    line: hit.line,
    before: hit.text,
    after,
  };
  return { status: 'ready', patch, diff: formatPatchDiff(patch) };
}

export function formatPatchDiff(p: LocatorPatch): string {
  return [
    `--- a/${p.file}`,
    `+++ b/${p.file}`,
    `@@ -${p.line},1 +${p.line},1 @@`,
    `-${p.before}`,
    `+${p.after}`,
  ].join('\n');
}

/** Reads the patchable files under `root` (a package directory). */
export function readPatchableSources(root: string): SourceFile[] {
  const files: SourceFile[] = [];
  for (const entry of fs.readdirSync(root, { recursive: true, encoding: 'utf8' })) {
    const rel = entry.split(path.sep).join('/');
    if (rel.includes('node_modules/') || !PATCHABLE.test(rel)) continue;
    files.push({ path: rel, text: fs.readFileSync(path.join(root, entry), 'utf8') });
  }
  return files;
}

/** Writes the patch, refusing if the line changed since it was proposed. */
export function applyLocatorPatch(root: string, p: LocatorPatch): void {
  const file = path.join(root, p.file);
  const text = fs.readFileSync(file, 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(eol);
  if (lines[p.line - 1] !== p.before) {
    throw new Error(`${p.file}:${p.line} changed since the patch was proposed; propose it again.`);
  }
  lines[p.line - 1] = p.after;
  fs.writeFileSync(file, lines.join(eol));
}
