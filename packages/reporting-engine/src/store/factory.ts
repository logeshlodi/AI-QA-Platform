import path from 'node:path';
import { JsonRunRepository } from './json';
import type { RunRepository } from './repository';
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
