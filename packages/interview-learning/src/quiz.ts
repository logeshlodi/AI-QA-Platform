import { QUESTIONS } from './bank';
import { LEVELS, TOPICS, type Level, type Question, type Topic } from './types';

export interface PickOptions {
  topic?: Topic;
  level?: Level;
  count?: number;
  /** Same seed, same questions in the same order. */
  seed?: number;
}

/** A small seeded generator (mulberry32), so a quiz can be repeated exactly. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Questions matching the filters, shuffled by the seed, at most `count` of them. */
export function pickQuestions(options: PickOptions = {}, bank: readonly Question[] = QUESTIONS): Question[] {
  const matching = bank.filter(
    (q) => (!options.topic || q.topic === options.topic) && (!options.level || q.level === options.level),
  );
  const next = random(options.seed ?? Date.now());
  const shuffled = [...matching];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled.slice(0, options.count ?? shuffled.length);
}

/** How many questions each topic has, by level. */
export function coverage(bank: readonly Question[] = QUESTIONS): Record<Topic, Record<Level, number>> {
  const table = Object.fromEntries(
    TOPICS.map((t) => [t, Object.fromEntries(LEVELS.map((l) => [l, 0]))]),
  ) as Record<Topic, Record<Level, number>>;
  for (const q of bank) table[q.topic][q.level]++;
  return table;
}

export function formatQuestion(q: Question, index: number, total: number): string {
  return `[${index}/${total}] ${q.topic} · ${q.level}\n\n  ${q.question}\n`;
}

export function formatAnswer(q: Question): string {
  const lines = [
    '  A strong answer covers:',
    ...q.outline.map((p) => `   - ${p}`),
    '',
    '  See it in the code:',
  ];
  lines.push(...q.files.map((f) => `   ${f}`));
  if (q.lab) lines.push('', `  Practise it: pnpm lab ${q.lab.slice(0, 2)}  (${q.lab})`);
  return lines.join('\n') + '\n';
}

export function formatCoverage(bank: readonly Question[] = QUESTIONS): string {
  const table = coverage(bank);
  const rows = TOPICS.map((t) => {
    const c = table[t];
    return `  ${t.padEnd(12)} ${LEVELS.map((l) => String(c[l]).padStart(l.length)).join('  ')}`;
  });
  return [`  ${'topic'.padEnd(12)} ${LEVELS.join('  ')}`, ...rows, `\n  ${bank.length} questions`].join('\n');
}

export function formatScore(known: number, total: number, missed: Question[]): string {
  const lines = [`You knew ${known} of ${total}.`];
  if (missed.length) {
    lines.push('', 'Go back to:');
    for (const q of missed) lines.push(`  ${q.id.padEnd(15)} ${q.files[0]}`);
  }
  return lines.join('\n');
}
