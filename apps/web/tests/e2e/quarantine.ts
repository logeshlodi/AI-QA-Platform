import fs from 'node:fs';
import path from 'node:path';
import { FIXTURE_DIR } from './users';

/** The quarantine file the app writes after an approval, read straight from disk: the ground truth. */
export function quarantinedIds(): string[] {
  try {
    const entries = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'quarantine.json'), 'utf8')) as {
      testId: string;
    }[];
    return entries.map((e) => e.testId);
  } catch {
    return [];
  }
}
