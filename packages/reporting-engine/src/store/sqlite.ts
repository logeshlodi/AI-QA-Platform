import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { AttemptStatus, StoredRun } from '../types';
import type { RunRepository } from './repository';

/** The two history tables from the plan's data design. `project` on test_run holds the suite name. */
export const RUN_SCHEMA = `
CREATE TABLE IF NOT EXISTS test_run (
  id TEXT PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT,
  git_sha TEXT, branch TEXT, environment TEXT NOT NULL, project TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS test_result (
  run_id TEXT NOT NULL REFERENCES test_run(id), test_id TEXT NOT NULL, retry INTEGER NOT NULL,
  title TEXT NOT NULL, file TEXT NOT NULL, status TEXT NOT NULL, duration_ms INTEGER NOT NULL,
  error_message TEXT, failure_category TEXT, project TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (run_id, test_id, retry)
);
CREATE INDEX IF NOT EXISTS test_result_by_test ON test_result (test_id);
`;

// Minimal shape of node:sqlite that we use; loaded with require() so the package
// still loads on Node versions where the module is behind a flag.
interface Statement {
  run(...params: unknown[]): unknown;
  all(...params: unknown[]): Record<string, unknown>[];
}
interface Database {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  close(): void;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const optional = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

/** SQLite store on Node's built-in driver: one file, queryable with any SQLite tool. */
export class SqliteRunRepository implements RunRepository {
  readonly kind = 'sqlite';
  private readonly db: Database;

  constructor(file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const sqlite = createRequire(__filename)('node:sqlite') as {
      DatabaseSync: new (file: string) => Database;
    };
    this.db = new sqlite.DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    this.db.exec(RUN_SCHEMA);
    // A database created before the reporter existed has test_result without `project`.
    const columns = this.db.prepare('PRAGMA table_info(test_result)').all();
    if (!columns.some((column) => column.name === 'project')) {
      this.db.exec("ALTER TABLE test_result ADD COLUMN project TEXT NOT NULL DEFAULT ''");
    }
  }

  saveRun({ run, results }: StoredRun): void {
    this.db.exec('BEGIN');
    try {
      this.db.prepare('DELETE FROM test_result WHERE run_id = ?').run(run.id);
      this.db
        .prepare(
          'INSERT OR REPLACE INTO test_run (id, started_at, finished_at, git_sha, branch, environment, project) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          run.id,
          run.startedAt,
          run.finishedAt,
          run.gitSha ?? null,
          run.branch ?? null,
          run.environment,
          run.suite,
        );
      const insert = this.db.prepare(
        'INSERT INTO test_result (run_id, test_id, retry, title, file, status, duration_ms, error_message, failure_category, project) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      );
      for (const r of results) {
        insert.run(
          run.id,
          r.testId,
          r.retry,
          r.title,
          r.file,
          r.status,
          Math.round(r.durationMs),
          r.errorMessage ?? null,
          r.failureCategory ?? null,
          r.project,
        );
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  listRuns(limit = 50): StoredRun[] {
    const runs = this.db
      .prepare('SELECT * FROM (SELECT * FROM test_run ORDER BY started_at DESC LIMIT ?) ORDER BY started_at')
      .all(limit);
    const results = this.db.prepare('SELECT * FROM test_result WHERE run_id = ? ORDER BY test_id, retry');
    return runs.map((row) => ({
      run: {
        id: text(row.id),
        suite: text(row.project),
        startedAt: text(row.started_at),
        finishedAt: text(row.finished_at),
        environment: text(row.environment),
        gitSha: optional(row.git_sha),
        branch: optional(row.branch),
      },
      results: results.all(text(row.id)).map((r) => ({
        runId: text(r.run_id),
        testId: text(r.test_id),
        retry: Number(r.retry),
        title: text(r.title),
        file: text(r.file),
        project: text(r.project),
        status: text(r.status) as AttemptStatus,
        durationMs: Number(r.duration_ms),
        errorMessage: optional(r.error_message),
        failureCategory: optional(r.failure_category),
      })),
    }));
  }

  close(): void {
    this.db.close();
  }
}
