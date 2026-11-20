import readline from 'node:readline';
import {
  formatAnswer,
  formatQuestion,
  formatScore,
  pickQuestions,
  type PickOptions,
  type Question,
} from '@aiqa/interview-learning';

/** Every question with its answer, for reading or printing. */
export function formatList(questions: Question[]): string {
  return questions
    .map((q, i) => formatQuestion(q, i + 1, questions.length) + '\n' + formatAnswer(q))
    .join('\n');
}

/** Ask each question, reveal the outline on Enter, and let the learner mark themselves. */
export async function runQuiz(
  options: PickOptions,
  io: { input: NodeJS.ReadableStream; output: NodeJS.WritableStream } = {
    input: process.stdin,
    output: process.stdout,
  },
): Promise<{ known: number; total: number; missed: Question[] }> {
  const questions = pickQuestions(options);
  // Lines are read through the iterator, which buffers them: piped or scripted answers are not lost.
  const rl = readline.createInterface({ input: io.input, terminal: false });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (prompt: string): Promise<string> => {
    io.output.write(prompt);
    const line = await lines.next();
    return line.done ? '' : String(line.value);
  };
  const say = (text: string) => io.output.write(text + '\n');
  const missed: Question[] = [];
  try {
    for (const [i, q] of questions.entries()) {
      say(formatQuestion(q, i + 1, questions.length));
      await ask('  (think it through, then press Enter) ');
      say('\n' + formatAnswer(q));
      const mark = (await ask('  Did your answer cover it? [y/n] ')).trim().toLowerCase();
      if (!mark.startsWith('y')) missed.push(q);
      say('');
    }
  } finally {
    rl.close();
  }
  const result = { known: questions.length - missed.length, total: questions.length, missed };
  say(formatScore(result.known, result.total, result.missed));
  return result;
}
