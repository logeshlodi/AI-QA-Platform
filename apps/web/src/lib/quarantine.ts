import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { config } from './config';

/** A test taken out of the gate on a person's decision, with who asked and who approved. */
export const QuarantineEntry = z.object({
  testId: z.string().min(1).max(200),
  reason: z.string().min(1).max(500),
  requestedBy: z.string(),
  approvedBy: z.string(),
  at: z.string(),
});
export type QuarantineEntry = z.infer<typeof QuarantineEntry>;

export function listQuarantine(file = config.data.quarantine): QuarantineEntry[] {
  try {
    return z.array(QuarantineEntry).parse(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    return [];
  }
}

function save(entries: QuarantineEntry[], file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Write then rename, so a reader never sees half a file.
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(entries, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

/** Adds an entry; a test already quarantined keeps its first entry (approving twice changes nothing). */
export function addQuarantine(entry: QuarantineEntry, file = config.data.quarantine): 'added' | 'already' {
  const entries = listQuarantine(file);
  if (entries.some((e) => e.testId === entry.testId)) return 'already';
  save([...entries, QuarantineEntry.parse(entry)], file);
  return 'added';
}

export function removeQuarantine(testId: string, file = config.data.quarantine): boolean {
  const entries = listQuarantine(file);
  const rest = entries.filter((e) => e.testId !== testId);
  if (rest.length === entries.length) return false;
  save(rest, file);
  return true;
}
