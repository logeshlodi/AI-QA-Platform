import { rmSync } from 'node:fs';
import path from 'node:path';

/** Vitest global setup for the consumer project: delete the old pact files before writing new ones. */
export default function cleanPacts(): void {
  rmSync(path.resolve(__dirname, '../../pacts'), { recursive: true, force: true });
}
