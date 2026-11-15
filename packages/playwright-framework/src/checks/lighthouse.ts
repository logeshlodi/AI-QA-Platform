import { chromium, type Page } from '@playwright/test';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

// Lighthouse ships as an ES module with its own dependency tree. Running its CLI in a child process
// keeps it out of Playwright's TypeScript loader, which cannot resolve that tree under pnpm.
const LIGHTHOUSE_CLI = join(dirname(require.resolve('lighthouse/package.json')), 'cli', 'index.js');

export type Category = 'performance' | 'accessibility' | 'best-practices' | 'seo';
export type Scores = Record<Category, number>;
export interface AuditOptions {
  url: string;
  categories?: Category[];
  /** Folder for the HTML report. Skipped when omitted. */
  reportDir?: string;
  reportName?: string;
  channel?: string;
  /** Called with the page before the audit, e.g. to log in. */
  prepare?: (page: Page) => Promise<void>;
}

/** Ask the OS for a free port; Lighthouse talks to the browser over the DevTools protocol on it. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

/**
 * Runs Lighthouse against a URL in a browser that Playwright launched, and returns 0-100 scores.
 * Playwright owns the browser (so login steps can run first); Lighthouse attaches through the debugging port.
 */
export async function auditWithLighthouse(opts: AuditOptions): Promise<Scores> {
  const categories = opts.categories ?? ['performance', 'accessibility', 'best-practices', 'seo'];
  const port = await freePort();
  const profile = await mkdtemp(join(tmpdir(), 'aiqa-lh-'));
  const context = await chromium.launchPersistentContext(profile, {
    channel: opts.channel,
    headless: true,
    args: [`--remote-debugging-port=${port}`],
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    if (opts.prepare) await opts.prepare(page);
    const out = join(profile, 'lh');
    await run(
      process.execPath,
      [
        LIGHTHOUSE_CLI,
        opts.url,
        `--port=${port}`,
        '--output=json',
        '--output=html',
        `--output-path=${out}`,
        `--only-categories=${categories.join(',')}`,
        '--quiet',
      ],
      { maxBuffer: 64 * 1024 * 1024, timeout: 110_000 },
    );
    const lhr = JSON.parse(await readFile(`${out}.report.json`, 'utf8')) as {
      categories: Record<string, { score: number | null }>;
    };

    if (opts.reportDir) {
      await mkdir(opts.reportDir, { recursive: true });
      await copyFile(`${out}.report.html`, join(opts.reportDir, `${opts.reportName ?? 'lighthouse'}.html`));
    }
    const scores = {} as Scores;
    for (const c of categories) scores[c] = Math.round((lhr.categories[c]?.score ?? 0) * 100);
    return scores;
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
}
