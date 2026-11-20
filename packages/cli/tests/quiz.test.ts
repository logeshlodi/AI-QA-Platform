import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { formatList, runQuiz } from '../src';
import { pickQuestions } from '@aiqa/interview-learning';

describe('aiqa quiz', () => {
  it('asks, reveals the outline, and scores the marks the learner gives', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    let printed = '';
    output.on('data', (chunk: Buffer) => (printed += chunk.toString()));
    // Two questions: Enter then "y" for the first, Enter then "n" for the second.
    input.end('\ny\n\nn\n');

    const result = await runQuiz({ topic: 'security', count: 2, seed: 3 }, { input, output });

    expect(result).toMatchObject({ known: 1, total: 2 });
    expect(result.missed).toHaveLength(1);
    expect(printed).toContain('A strong answer covers:');
    expect(printed).toContain('You knew 1 of 2.');
    expect(printed).toContain(result.missed[0]!.files[0]);
  });

  it('lists questions with answers for reading', () => {
    const text = formatList(pickQuestions({ topic: 'contracts', seed: 1 }));
    expect(text).toContain('[1/');
    expect(text).toContain('See it in the code:');
  });
});
