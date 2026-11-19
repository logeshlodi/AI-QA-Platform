// Warns (never fails) when a Playwright Docker image tag differs from @playwright/test in the catalog.
// Builds still work when they differ, because every job installs the matching browsers, but the
// image's system libraries should follow the version, so the tag is worth bumping by hand.
import { readFileSync } from 'node:fs';

const catalog = readFileSync('pnpm-workspace.yaml', 'utf8');
const version = /'@playwright\/test':\s*([\d.]+)/.exec(catalog)?.[1];
if (!version) {
  console.log('::warning::@playwright/test not found in pnpm-workspace.yaml');
  process.exit(0);
}
const files = [
  'infrastructure/docker/Dockerfile',
  '.github/workflows/ci.yml',
  'azure-pipelines.yml',
  'Jenkinsfile',
];
let stale = 0;
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const [, tag] of line.matchAll(/mcr\.microsoft\.com\/playwright:v([\d.]+)-/g)) {
      if (tag !== version) {
        stale++;
        console.log(
          `::warning file=${file},line=${i + 1}::Playwright image v${tag} but @playwright/test is ${version}. Bump the tag to v${version}.`,
        );
      }
    }
  });
}
console.log(
  stale
    ? `${stale} image tag(s) behind @playwright/test ${version}`
    : `Image tags match @playwright/test ${version}`,
);
