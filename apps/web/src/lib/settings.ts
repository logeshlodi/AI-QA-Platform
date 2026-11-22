import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { config } from './config';

/** What the admin area can change. Kept in a small JSON file next to the run history. */
export const SettingsSchema = z.object({
  /** Model steps per chat answer: each tool call is one step, the answer one more. */
  chatMaxSteps: z.coerce.number().int().min(2).max(8),
  /** A CPU model can take minutes per step; past this the answer is cut off. */
  chatTimeoutSec: z.coerce.number().int().min(30).max(1800),
  /** Off: the chat cannot even ask for a change, only read. */
  chatWritesEnabled: z.boolean(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = { chatMaxSteps: 4, chatTimeoutSec: 600, chatWritesEnabled: true };

export function readSettings(file = config.data.settings): Settings {
  try {
    return SettingsSchema.parse({ ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(file, 'utf8')) });
  } catch {
    return DEFAULT_SETTINGS; // missing or broken file: the defaults, never a crash
  }
}

export function writeSettings(settings: Settings, file = config.data.settings): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(SettingsSchema.parse(settings), null, 2) + '\n');
}
