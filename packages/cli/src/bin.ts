import path from 'node:path';
import { chromium } from '@playwright/test';
import { targetNames, targetUrl, type TargetName } from '@aiqa/shared';
import { Argument, Command, InvalidArgumentError, Option } from 'commander';
import { ENTITIES, makeData, type Entity } from './commands/data';
import { metricTrends } from '@aiqa/reporting-engine';
import { formatFlaky, formatHistory, formatPerf, loadRuns } from './commands/history';
import { formatFiles, renderPage, writeFiles } from './commands/new-page';

const FRAMEWORK = path.resolve(__dirname, '..', '..', 'playwright-framework');

const positiveInt = (value: string): number => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new InvalidArgumentError('must be a whole number above 0');
  return n;
};

async function ariaSnapshotOf(url: string): Promise<string> {
  // PW_CHANNEL=chrome or msedge uses an installed browser, as in playwright.config.ts.
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    return await page.locator('body').ariaSnapshot();
  } finally {
    await browser.close();
  }
}

const program = new Command()
  .name('aiqa')
  .description('AI-QA-Platform tools: generate tests, read run history, make test data');

program
  .command('new')
  .description('generate code')
  .command('page')
  .description('generate a page object and a starter spec; with --url, locators come from the live page')
  .argument('<name>', 'page name, e.g. "Login" or "order history"')
  .addOption(
    new Option('--target <target>', 'demo target the page belongs to')
      .choices(targetNames)
      .default('saucedemo'),
  )
  .option('--path <path>', 'path relative to the target base URL', '/')
  .option('--url', 'open the page and build locators from its accessibility tree')
  .option('--dry-run', 'print the files instead of writing them')
  .option('--force', 'overwrite existing files')
  .action(
    async (
      name: string,
      opts: { target: string; path: string; url?: boolean; dryRun?: boolean; force?: boolean },
    ) => {
      const pageUrl = new URL(opts.path, targetUrl(opts.target as TargetName)).toString();
      const ariaSnapshot = opts.url ? await ariaSnapshotOf(pageUrl) : undefined;
      const files = await formatFiles(
        FRAMEWORK,
        renderPage({
          name,
          site: opts.target,
          urlPath: opts.path,
          target: opts.target,
          ariaSnapshot,
        }),
      );
      if (opts.dryRun) {
        for (const f of files) console.log(`--- ${f.path}\n${f.content}`);
        return;
      }
      for (const written of writeFiles(FRAMEWORK, files, opts.force)) {
        console.log(`wrote packages/playwright-framework/${written.replaceAll('\\', '/')}`);
      }
      console.log(
        'Next: rename the locators, add actions, and register a fixture in src/fixtures/index.ts if specs share it.',
      );
    },
  );

program
  .command('history')
  .description('recent recorded runs, newest first')
  .option('--suite <suite>', 'only this suite, e.g. ui or api')
  .option('--limit <n>', 'how many runs', positiveInt, 15)
  .action((opts: { suite?: string; limit: number }) =>
    console.log(formatHistory(loadRuns(), opts.suite, opts.limit)),
  );

program
  .command('flaky')
  .description('tests that passed only on retry or flipped between runs')
  .action(() => console.log(formatFlaky(loadRuns())));

program
  .command('perf')
  .description('performance metrics against their usual level: regressions first')
  .option('--all', 'list steady metrics too')
  .option('--fail-on-regression', 'exit with code 1 when a metric regressed (for CI)')
  .action((opts: { all?: boolean; failOnRegression?: boolean }) => {
    const trends = metricTrends(loadRuns());
    console.log(formatPerf(trends, opts.all));
    if (opts.failOnRegression && trends.some((t) => t.verdict === 'regressed')) process.exitCode = 1;
  });

program
  .command('data')
  .description('print seeded test data as JSON')
  .addArgument(new Argument('<entity>', 'what to make').choices(ENTITIES))
  .option('--count <n>', 'how many', positiveInt, 1)
  .option('--seed <n>', 'seed for reproducible data', positiveInt, 1)
  .action((entity: Entity, opts: { count: number; seed: number }) =>
    console.log(JSON.stringify(makeData(entity, opts.count, opts.seed), null, 2)),
  );

program.parseAsync().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
