import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createRunRepository,
  JsonRunRepository,
  MemoryRunRepository,
  SqliteRunRepository,
  type RunRepository,
} from '../src';
import { run } from './helpers';

const dirs: string[] = [];
const tempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiqa-runs-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const sqliteAvailable = (() => {
  try {
    new SqliteRunRepository(path.join(tempDir(), 'probe.db')).close();
    return true;
  } catch {
    return false;
  }
})();

// One contract, three stores: every repository must behave the same.
const stores: [string, () => RunRepository, boolean][] = [
  ['memory', () => new MemoryRunRepository(), true],
  ['json', () => new JsonRunRepository(tempDir()), true],
  ['sqlite', () => new SqliteRunRepository(path.join(tempDir(), 'history.db')), sqliteAvailable],
];

describe.each(stores)('%s run repository', (_name, make, available) => {
  it.skipIf(!available)('round-trips a run with all its attempts', () => {
    const repo = make();
    const stored = run({ a: ['failed', 'passed'], b: ['skipped'] });
    stored.run.gitSha = 'abc123';
    repo.saveRun(stored);
    expect(repo.listRuns()).toEqual([stored]);
    repo.close();
  });

  it.skipIf(!available)('lists the most recent runs, oldest first', () => {
    const repo = make();
    const runs = [run({ a: ['passed'] }), run({ a: ['failed'] }), run({ a: ['passed'] })];
    for (const r of [runs[2]!, runs[0]!, runs[1]!]) repo.saveRun(r);
    expect(repo.listRuns(2).map((r) => r.run.id)).toEqual([runs[1]!.run.id, runs[2]!.run.id]);
    repo.close();
  });

  it.skipIf(!available)('saving the same run id again replaces it', () => {
    const repo = make();
    const first = run({ a: ['failed'] });
    repo.saveRun(first);
    repo.saveRun({
      ...first,
      results: first.results.map((r) => ({
        ...r,
        status: 'passed' as const,
        errorMessage: undefined,
        failureCategory: undefined,
      })),
    });
    const [only] = repo.listRuns();
    expect(repo.listRuns()).toHaveLength(1);
    expect(only?.results[0]?.status).toBe('passed');
    repo.close();
  });
});

describe('JsonRunRepository file names', () => {
  it('stores a run whose id holds characters Windows forbids in file names', () => {
    const dir = tempDir();
    const repo = new JsonRunRepository(dir);
    const stored = run({ a: ['passed'] });
    stored.run.id = 'run:2026/11<19>*?"|';
    repo.saveRun(stored);
    repo.saveRun(stored); // the second save replaces the first, it does not add a file
    expect(fs.readdirSync(path.join(dir, 'runs'))).toHaveLength(1);
    expect(repo.listRuns()[0]?.run.id).toBe('run:2026/11<19>*?"|');
  });
});

describe('createRunRepository', () => {
  it('uses SQLite when Node has it, JSON files otherwise', () => {
    const repo = createRunRepository(tempDir());
    expect(repo.kind).toBe(sqliteAvailable ? 'sqlite' : 'json');
    repo.close();
  });

  it('honours an explicit JSON choice', () => {
    expect(createRunRepository(tempDir(), 'json').kind).toBe('json');
  });

  it('a damaged JSON file does not hide the rest of the history', () => {
    const dir = tempDir();
    const repo = new JsonRunRepository(dir);
    repo.saveRun(run({ a: ['passed'] }));
    fs.writeFileSync(path.join(dir, 'runs', '0000_broken.json'), '{ not json');
    expect(repo.listRuns()).toHaveLength(1);
  });
});
