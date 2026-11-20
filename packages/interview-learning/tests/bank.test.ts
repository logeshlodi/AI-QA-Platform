import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { coverage, formatAnswer, LEVELS, pickQuestions, QUESTIONS, TOPICS } from '../src';

const ROOT = path.resolve(__dirname, '..', '..', '..');

describe('question bank', () => {
  it('has unique ids of the form <topic>-<n>', () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of QUESTIONS) expect(q.id).toMatch(new RegExp(`^${q.topic}-\\d+$`));
  });

  it('covers every topic on the learning path, with at least three questions each', () => {
    for (const [topic, byLevel] of Object.entries(coverage())) {
      const total = LEVELS.reduce((n, l) => n + byLevel[l], 0);
      expect(total, topic).toBeGreaterThanOrEqual(3);
    }
  });

  it('points only at files that exist, so an answer never sends you nowhere', () => {
    const missing = QUESTIONS.flatMap((q) =>
      q.files.filter((f) => !fs.existsSync(path.join(ROOT, f))).map((f) => `${q.id}: ${f}`),
    );
    expect(missing).toEqual([]);
  });

  it('names only labs that exist', () => {
    for (const q of QUESTIONS.filter((x) => x.lab)) {
      expect(fs.existsSync(path.join(ROOT, 'packages/examples/labs', q.lab!)), q.id).toBe(true);
    }
  });

  it('gives every question an outline of at least three points', () => {
    for (const q of QUESTIONS) expect(q.outline.length, q.id).toBeGreaterThanOrEqual(3);
  });

  it('uses the topics the learning path lists', () => {
    const readme = fs.readFileSync(path.join(ROOT, 'docs/learning/README.md'), 'utf8');
    for (const topic of TOPICS) expect(readme, topic).toContain(`\`${topic}\``);
  });
});

describe('pickQuestions', () => {
  it('filters by topic and level', () => {
    const picked = pickQuestions({ topic: 'security', level: 'core', seed: 1 });
    expect(picked.length).toBeGreaterThan(0);
    for (const q of picked) expect([q.topic, q.level]).toEqual(['security', 'core']);
  });

  it('repeats the same order for the same seed and limits the count', () => {
    const a = pickQuestions({ seed: 42, count: 5 }).map((q) => q.id);
    expect(a).toHaveLength(5);
    expect(pickQuestions({ seed: 42, count: 5 }).map((q) => q.id)).toEqual(a);
    expect(pickQuestions({ seed: 43, count: 5 }).map((q) => q.id)).not.toEqual(a);
  });

  it('formats an answer with its files and lab command', () => {
    const q = QUESTIONS.find((x) => x.id === 'waiting-3')!;
    const text = formatAnswer(q);
    expect(text).toContain('eslint.config.mjs');
    expect(text).toContain('pnpm lab 04');
  });
});
