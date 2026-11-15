import { setSimilarity, textSimilarity } from './similarity';
import type { ElementDescriptor } from './types';

/**
 * Relative weight of each signal. A test id is the strongest evidence because a
 * developer put it there to be stable; position in the tree is the weakest.
 */
export const WEIGHTS = {
  testId: 0.45,
  accessibleName: 0.2,
  text: 0.15,
  attributes: 0.12,
  role: 0.1,
  ancestorPath: 0.08,
  tag: 0.05,
} as const;

/** Attribute tokens we compare. `id` is left out on purpose: generated ids are what break locators. */
const attributeTokens = (attrs: Record<string, string>): string[] => {
  const tokens: string[] = [];
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'id' || !value) continue;
    if (key === 'class')
      tokens.push(
        ...value
          .split(/\s+/)
          .filter(Boolean)
          .map((c) => `class:${c}`),
      );
    else tokens.push(`${key}:${value}`);
  }
  return tokens;
};

/**
 * Similarity between a stored fingerprint and a live element, 0..1.
 * Only signals the fingerprint actually has take part, so an element with no
 * test id is not punished for a missing test id.
 */
export function scoreElement(fingerprint: ElementDescriptor, element: ElementDescriptor): number {
  let total = 0;
  let earned = 0;
  const add = (weight: number, present: boolean, similarity: () => number) => {
    if (!present) return;
    total += weight;
    earned += weight * similarity();
  };

  add(WEIGHTS.testId, fingerprint.testId !== '', () => (fingerprint.testId === element.testId ? 1 : 0));
  add(WEIGHTS.accessibleName, fingerprint.accessibleName !== '', () =>
    textSimilarity(fingerprint.accessibleName, element.accessibleName),
  );
  add(WEIGHTS.text, fingerprint.text !== '', () => textSimilarity(fingerprint.text, element.text));
  add(WEIGHTS.attributes, attributeTokens(fingerprint.attributes).length > 0, () =>
    setSimilarity(attributeTokens(fingerprint.attributes), attributeTokens(element.attributes)),
  );
  add(WEIGHTS.role, fingerprint.role !== '', () => (fingerprint.role === element.role ? 1 : 0));
  add(WEIGHTS.ancestorPath, fingerprint.ancestorPath !== '', () =>
    setSimilarityOrdered(fingerprint.ancestorPath, element.ancestorPath),
  );
  add(WEIGHTS.tag, fingerprint.tag !== '', () => (fingerprint.tag === element.tag ? 1 : 0));

  return total === 0 ? 0 : earned / total;
}

/** Share of the ancestor chain that matches position by position from the element upwards. */
function setSimilarityOrdered(a: string, b: string): number {
  const x = a.split('>').reverse();
  const y = b.split('>').reverse();
  const length = Math.max(x.length, y.length);
  let same = 0;
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] === y[i]) same++;
  return length === 0 ? 0 : same / length;
}
