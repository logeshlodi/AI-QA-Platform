/**
 * Copies the repository's docs/ into the site's content folder without changing the originals:
 * the first heading becomes the page title (Starlight's frontmatter), README.md becomes a folder's
 * index, and links are rewritten: to another doc, as a site path under the base; to anything else in
 * the repository, as a link to it on GitHub.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(SITE, '..', '..');
const DOCS = path.join(REPO_ROOT, 'docs');
const OUT = path.join(SITE, 'src', 'content', 'docs');
const GITHUB = 'https://github.com/logeshlodi/AI-QA-Platform/blob/main';
const BASE = (process.env.DOCS_BASE ?? '/').replace(/\/?$/, '/');

/** docs/learning/README.md -> "learning/"; docs/STATUS.md -> "status/" (Astro lower-cases slugs). */
export function slugOf(relFromDocs: string): string {
  const posix = relFromDocs.replaceAll('\\', '/');
  const noExt = posix.replace(/\.md$/, '');
  const page = noExt.endsWith('README') ? noExt.slice(0, -'README'.length) : `${noExt}/`;
  return page.toLowerCase();
}

/** A doc's Markdown, ready for Starlight. Exported for its unit test. */
export function convert(markdown: string, relFromDocs: string, base = BASE): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const h1 = lines.findIndex((l) => /^# /.test(l));
  const title = h1 >= 0 ? lines[h1]!.slice(2).trim() : path.basename(relFromDocs, '.md');
  if (h1 >= 0) lines.splice(h1, 1);
  const here = path.posix.dirname(relFromDocs.replaceAll('\\', '/'));
  const body = lines
    .join('\n')
    .replace(/\]\((?!https?:|mailto:|#)([^)\s]+?)(#[^)\s]*)?\)/g, (_m, target: string, hash = '') => {
      const fromRoot = path.posix.normalize(path.posix.join('docs', here, target));
      if (fromRoot.startsWith('docs/') && fromRoot.endsWith('.md'))
        return `](${base}${slugOf(fromRoot.slice('docs/'.length))}${hash})`;
      // A folder inside docs/ (no extension): its README is the site's index page for it.
      if (fromRoot.startsWith('docs/') && !path.posix.extname(fromRoot))
        return `](${base}${slugOf(`${fromRoot.slice('docs/'.length).replace(/\/$/, '')}/README.md`)}${hash})`;
      return `](${GITHUB}/${fromRoot.replace(/\/$/, '')}${hash})`;
    });
  const yaml = JSON.stringify(title); // a JSON string is a valid YAML scalar, quotes and colons included
  return `---\ntitle: ${yaml}\neditUrl: ${JSON.stringify(`${GITHUB.replace('/blob/', '/edit/')}/docs/${relFromDocs.replaceAll('\\', '/')}`)}\n---\n${body.replace(/^\n+/, '\n')}`;
}

function walk(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : [],
    );
}

export function sync(): number {
  // Everything but the hand-written home page is generated; clear the old copies first.
  for (const entry of fs.readdirSync(OUT))
    if (entry !== 'index.mdx') fs.rmSync(path.join(OUT, entry), { recursive: true, force: true });
  let count = 0;
  for (const file of walk(DOCS)) {
    const rel = path.relative(DOCS, file);
    // A folder's README is its index page; every other file keeps its name, lower-cased like its slug.
    const target = path.join(
      OUT,
      rel.endsWith('README.md') ? path.join(path.dirname(rel), 'index.md') : rel.toLowerCase(),
    );
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, convert(fs.readFileSync(file, 'utf8'), rel));
    count++;
  }
  return count;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Synced ${sync()} pages from docs/ (base ${BASE}).`);
}
