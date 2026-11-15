const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

const bigrams = (s: string): Map<string, number> => {
  const grams = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    grams.set(g, (grams.get(g) ?? 0) + 1);
  }
  return grams;
};

/**
 * Sorensen-Dice similarity on character bigrams, 0..1.
 * WHY Dice over Levenshtein: it is order-tolerant ("Add to cart" vs "Add item to cart")
 * and linear in string length, which matters when scoring hundreds of elements.
 */
export function textSimilarity(a: string, b: string): number {
  const x = normalise(a);
  const y = normalise(b);
  if (x === y) return x.length === 0 ? 0 : 1;
  if (x.length < 2 || y.length < 2) return 0;
  const gx = bigrams(x);
  const gy = bigrams(y);
  let overlap = 0;
  for (const [gram, count] of gx) overlap += Math.min(count, gy.get(gram) ?? 0);
  return (2 * overlap) / (x.length - 1 + (y.length - 1));
}

/** Jaccard similarity of two sets, 0..1. Two empty sets are not evidence of a match. */
export function setSimilarity(a: Iterable<string>, b: Iterable<string>): number {
  const x = new Set(a);
  const y = new Set(b);
  if (x.size === 0 || y.size === 0) return 0;
  let shared = 0;
  for (const item of x) if (y.has(item)) shared++;
  return shared / (x.size + y.size - shared);
}
