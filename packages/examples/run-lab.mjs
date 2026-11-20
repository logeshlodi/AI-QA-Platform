#!/usr/bin/env node
// pnpm lab 03              run lab 03's exercise
// pnpm lab 03 --solution   run its solution instead (try the exercise first)
// pnpm lab                 list the labs
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const labs = readdirSync(path.join(here, 'labs'))
  .filter((name) => /^\d\d-/.test(name))
  .sort();
const [number, ...rest] = process.argv.slice(2);

if (!number) {
  console.log('Labs (pnpm lab <number>):\n');
  for (const lab of labs) {
    const title = readFileSync(path.join(here, 'labs', lab, 'README.md'), 'utf8')
      .split('\n')[0]
      .replace(/^#\s*/, '');
    console.log(`  ${title}`);
  }
  process.exit(0);
}

const lab = labs.find((name) => name.startsWith(number.padStart(2, '0')));
if (!lab) {
  console.error(`No lab ${number}. Run "pnpm lab" for the list.`);
  process.exit(2);
}
const solution = rest.includes('--solution');
const extra = rest.filter((arg) => arg !== '--solution');
console.log(`Lab ${lab}: ${solution ? 'SOLUTION' : 'exercise'} (the README is labs/${lab}/README.md)\n`);
// Playwright's own CLI, run by this Node: no shell, the same on Windows, macOS and Linux.
const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
const result = spawnSync(
  process.execPath,
  [cli, 'test', `--project=${solution ? 'solution' : 'exercise'}`, '--workers=2', `labs/${lab}/`, ...extra],
  { cwd: here, stdio: 'inherit' },
);
process.exit(result.status ?? 1);
