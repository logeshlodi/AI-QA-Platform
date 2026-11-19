// Opens the run-history dashboard that `pnpm test:ui` and `pnpm test:api` keep up to date.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(import.meta.dirname, '..', '.aiqa', 'dashboard', 'index.html');
if (!existsSync(file)) {
  console.error(`No dashboard yet at ${file}\nRun "npx pnpm test:api" or "npx pnpm test:ui" first.`);
  process.exit(1);
}
const [command, args] =
  process.platform === 'win32'
    ? ['cmd', ['/c', 'start', '', file]]
    : [process.platform === 'darwin' ? 'open' : 'xdg-open', [file]];
spawn(command, args, { stdio: 'ignore', detached: true }).unref();
console.log(file);
