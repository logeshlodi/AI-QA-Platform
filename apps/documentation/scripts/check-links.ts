/**
 * Every link inside the built site that points into it must reach a page or file of the site:
 * a broken link between two docs fails the build here, not in a reader's browser.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const BASE = (process.env.DOCS_BASE ?? '/').replace(/\/?$/, '/');

function walk(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

const broken: string[] = [];
for (const file of walk(DIST).filter((f) => f.endsWith('.html'))) {
  const html = fs.readFileSync(file, 'utf8');
  for (const [, href] of html.matchAll(/href="([^"#?]+)[^"]*"/g)) {
    if (!href || !href.startsWith(BASE) || href.startsWith('//')) continue;
    const rel = decodeURI(href.slice(BASE.length));
    const target = path.join(DIST, rel);
    const ok =
      fs.existsSync(target) &&
      (fs.statSync(target).isFile() || fs.existsSync(path.join(target, 'index.html')));
    if (!ok && !fs.existsSync(`${target}.html`)) broken.push(`${path.relative(DIST, file)} -> ${href}`);
  }
}
if (broken.length) {
  console.error(`Broken links (${broken.length}):\n  ${[...new Set(broken)].join('\n  ')}`);
  process.exit(1);
}
console.log('Every internal link resolves.');
