#!/usr/bin/env node
// Fails when any installed dependency (dev dependencies included) carries a licence outside the
// allow-list. The project rule is open-source only, so a new licence must be looked at by a person
// before it ships: either it is open source and joins ALLOWED, or the package gets a named exception
// with the reason, or the dependency goes.
//
//   node scripts/check-licences.mjs           # report and exit 1 on anything not allowed
//   node scripts/check-licences.mjs --list    # every licence and how many packages use it
import { execSync } from 'node:child_process';

/** OSI-approved licences, plus public-domain dedications. SPDX ids as pnpm reports them. */
const ALLOWED = new Set([
  'MIT',
  'MIT-0',
  'ISC',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'BlueOak-1.0.0',
  'MPL-2.0',
  'Python-2.0',
  'PSF-2.0',
  'CC0-1.0',
  'Unlicense',
  'Zlib',
  'CC-BY-4.0', // data only (caniuse-lite and similar): attribution, no code
]);

/**
 * Packages allowed despite their licence, each with the reason. Keep this list short; every entry
 * is a decision someone can question.
 */
const EXCEPTIONS = {
  sentry:
    'FSL-1.1-Apache-2.0 (source-available, becomes Apache-2.0 after two years). Not ours to drop: ' +
    'Lighthouse -> @sentry/node -> @sentry/bundler-plugins -> sentry. Only installed for the Lighthouse ' +
    'audit; nothing in this repository calls it and nothing of it is distributed.',
  'css-value':
    'MIT, stated in its Readme; its package.json has no licence field, so pnpm reports "Unknown". ' +
    'webdriverio -> css-value (mobile package).',
  'spdx-exceptions':
    'CC-BY-3.0, data only: the list of SPDX licence-exception names. appium -> @appium/docutils -> ' +
    'normalize-package-data -> spdx-expression-parse -> spdx-exceptions.',
  'truncate-utf8-bytes':
    'WTFPL, a permissive public-domain-style licence (free software by the FSF). appium -> ' +
    '@appium/support -> sanitize-filename -> truncate-utf8-bytes.',
};

/** "(MIT OR CC0-1.0)" is fine when any one side is allowed; "(A AND B)" needs both. */
function allowed(expression) {
  const text = expression.replace(/^\(|\)$/g, '').trim();
  if (text.includes(' OR ')) return text.split(' OR ').some((part) => allowed(part));
  if (text.includes(' AND ')) return text.split(' AND ').every((part) => allowed(part));
  return ALLOWED.has(text);
}

// One fixed command string with no user input: a shell resolves pnpm (pnpm.cmd on Windows).
const raw = execSync('pnpm licenses list --json', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
/** { "<licence>": [{ name, versions, ... }] } */
const byLicence = JSON.parse(raw);

if (process.argv.includes('--list')) {
  for (const [licence, packages] of Object.entries(byLicence).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${String(packages.length).padStart(5)}  ${licence}`);
  }
}

const problems = [];
const excused = [];
for (const [licence, packages] of Object.entries(byLicence)) {
  if (allowed(licence)) continue;
  for (const pkg of packages) {
    const line = `${pkg.name}@${pkg.versions.join(', ')}  ${licence}`;
    if (EXCEPTIONS[pkg.name]) excused.push(`${line}\n      ${EXCEPTIONS[pkg.name]}`);
    else problems.push(line);
  }
}

const total = Object.values(byLicence).reduce((sum, packages) => sum + packages.length, 0);
for (const line of excused) console.log(`excepted: ${line}`);
const stale = Object.keys(EXCEPTIONS).filter((name) => !excused.some((line) => line.startsWith(`${name}@`)));
for (const name of stale) console.log(`note: the exception for "${name}" is no longer needed; remove it.`);

if (problems.length > 0) {
  console.error(`\n${problems.length} package(s) with a licence outside the allow-list:`);
  for (const line of problems) console.error(`  ${line}`);
  console.error(
    '\nCheck each licence. Open source: add it to ALLOWED. Otherwise: an EXCEPTIONS entry with the reason, or drop the dependency.',
  );
  process.exit(1);
}
console.log(
  `licences: ${total} packages checked, all allowed${excused.length ? ` (${excused.length} named exception)` : ''}.`,
);
