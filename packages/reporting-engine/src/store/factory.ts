import fs from 'node:fs';
import path from 'node:path';
import { JsonRunRepository } from './json';
import { MemoryRunRepository, type RunRepository } from './repository';
import { SqliteRunRepository } from './sqlite';

export type RunStoreKind = 'auto' | 'sqlite' | 'json';

/** Factory: SQLite when this Node version ships it unflagged, JSON files otherwise. */
export function createRunRepository(directory: string, kind: RunStoreKind = 'auto'): RunRepository {
  if (kind === 'json') return new JsonRunRepository(directory);
  try {
    return new SqliteRunRepository(path.join(directory, 'history.db'));
  } catch (error) {
    if (kind === 'sqlite') throw error;
    return new JsonRunRepository(directory);
  }
}

/**
 * Opens existing history for reading only: never creates a folder, database or file. Readers
 * (the CLI, CI summaries) may not own the folder: a Docker container running as root can have
 * written it. Whatever store is there is read; no history at all reads as an empty list.
 */
export function openRunHistory(directory: string): RunRepository {
  const db = path.join(directory, 'history.db');
  if (fs.existsSync(db)) {
    try {
      return new SqliteRunRepository(db, { readOnly: true });
    } catch {
      // This Node has no node:sqlite: fall through to the JSON files, if any.
    }
  }
  if (fs.existsSync(path.join(directory, 'runs')))
    return new JsonRunRepository(directory, { readOnly: true });
  return new MemoryRunRepository();
}
