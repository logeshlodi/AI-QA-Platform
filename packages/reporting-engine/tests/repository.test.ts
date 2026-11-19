import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createRunRepository,
  openRunHistory,
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

  it.skipIf(!available)('keeps the performance metrics a test recorded', () => {
    const repo = make();
    const stored = run({ a: ['passed'], b: ['passed'] });
    stored.results[0]!.metrics = { lcp_ms: 412.5, cls: 0.02 };
    repo.saveRun(stored);
    const [loaded] = repo.listRuns();
    expect(loaded?.results.find((r) => r.testId === 'a')?.metrics).toEqual({ lcp_ms: 412.5, cls: 0.02 });
    expect(loaded?.results.find((r) => r.testId === 'b')?.metrics).toBeUndefined();
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

describe('openRunHistory (read-only)', () => {
  it('reads an empty list from a folder that does not exist, and creates nothing', () => {
    const dir = path.join(tempDir(), 'missing');
    expect(openRunHistory(dir).listRuns()).toEqual([]);
    expect(fs.existsSync(dir)).toBe(false);
  });

  it('reads JSON history without writing to it', () => {
    const dir = tempDir();
    new JsonRunRepository(dir).saveRun(run({ a: ['passed'] }));
    expect(openRunHistory(dir).listRuns()).toHaveLength(1);
  });

  it.skipIf(!sqliteAvailable || process.getuid?.() === 0)(
    'reads SQLite history from a folder it cannot write to, and refuses to write',
    () => {
      const dir = tempDir();
      const writer = new SqliteRunRepository(path.join(dir, 'history.db'));
      writer.saveRun(run({ a: ['passed'], b: ['failed'] }));
      writer.close();
      fs.chmodSync(dir, 0o555); // what a root-owned folder looks like to the CI runner user
      try {
        const reader = openRunHistory(dir);
        expect(reader.kind).toBe('sqlite');
        expect(reader.listRuns()[0]?.results).toHaveLength(2);
        expect(() => reader.saveRun(run({ c: ['passed'] }))).toThrow();
        reader.close();
      } finally {
        fs.chmodSync(dir, 0o755);
      }
    },
  );
});

describe('SqliteRunRepository upgrades', () => {
  it.skipIf(!sqliteAvailable)(
    'adds the metrics column to a database from before metrics, keeping its runs',
    () => {
      const file = path.join(tempDir(), 'old.db');
      const { DatabaseSync } = createRequire(__filename)('node:sqlite') as {
        DatabaseSync: new (file: string) => { exec(sql: string): void; close(): void };
      };
      const old = new DatabaseSync(file);
      old.exec(`CREATE TABLE test_run (id TEXT PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT,
        git_sha TEXT, branch TEXT, environment TEXT NOT NULL, project TEXT NOT NULL);
      CREATE TABLE test_result (run_id TEXT NOT NULL, test_id TEXT NOT NULL, retry INTEGER NOT NULL,
        title TEXT NOT NULL, file TEXT NOT NULL, status TEXT NOT NULL, duration_ms INTEGER NOT NULL,
        error_message TEXT, failure_category TEXT, project TEXT NOT NULL DEFAULT '', PRIMARY KEY (run_id, test_id, retry));
      INSERT INTO test_run VALUES ('old-run', '2026-10-01T00:00:00.000Z', '2026-10-01T00:01:00.000Z', NULL, NULL, 'local', 'ui');
      INSERT INTO test_result VALUES ('old-run', 'a', 0, 'test a', 'tests/a.spec.ts', 'passed', 1000, NULL, NULL, 'chromium');`);
      old.close();

      const repo = new SqliteRunRepository(file);
      const fresh = run({ a: ['passed'] });
      fresh.results[0]!.metrics = { lcp_ms: 400 };
      repo.saveRun(fresh);
      const runs = repo.listRuns();
      expect(runs.map((r) => r.run.id)).toEqual(['old-run', fresh.run.id]);
      expect(runs[0]?.results[0]?.metrics).toBeUndefined();
      expect(runs[1]?.results[0]?.metrics).toEqual({ lcp_ms: 400 });
      repo.close();
    },
  );
});
