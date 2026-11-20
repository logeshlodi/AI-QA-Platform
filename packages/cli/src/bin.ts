import path from 'node:path';
import { chromium } from '@playwright/test';
import { targetNames, targetUrl, type TargetName } from '@aiqa/shared';
import { Argument, Command, InvalidArgumentError, Option } from 'commander';
import { ENTITIES, makeData, type Entity } from './commands/data';
import { metricTrends } from '@aiqa/reporting-engine';
import { formatFlaky, formatHistory, formatPerf, loadRuns } from './commands/history';
import { formatFiles, renderPage, writeFiles } from './commands/new-page';
import { formatList, runQuiz } from './commands/quiz';
import fs from 'node:fs';
import {
  askOnTerminal,
  formatAgentLog,
  formatHealingReviews,
  formatTriage,
  slug,
  specCheck,
} from './commands/agents';
import {
  buildTriageContexts,
  chooseModel,
  formatEval,
  generateSpec,
  JsonlRunLog,
  parsePlan,
  planPage,
  reviewHeals,
  runTriageEval,
  triage,
  TRIAGE_GATE,
} from '@aiqa/ai-agents';
import { createHealRepository, readPatchableSources } from '@aiqa/self-healing-engine';
import { loadEnv } from '@aiqa/shared';
import {
  formatCoverage,
  LEVELS,
  pickQuestions,
  TOPICS,
  type Level,
  type Topic,
} from '@aiqa/interview-learning';

const FRAMEWORK = path.resolve(__dirname, '..', '..', 'playwright-framework');

const positiveInt = (value: string): number => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new InvalidArgumentError('must be a whole number above 0');
  return n;
};

const FRAMEWORK_STATE = path.join(FRAMEWORK, '.aiqa');
const SAUCE_SESSION = path.join(FRAMEWORK_STATE, 'auth', 'saucedemo-standard.json');

async function ariaSnapshotOf(url: string, storageState?: string): Promise<string> {
  // PW_CHANNEL=chrome or msedge uses an installed browser, as in playwright.config.ts.
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
  try {
    const page = await browser.newPage({ storageState });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    return await page.locator('body').ariaSnapshot();
  } finally {
    await browser.close();
  }
}

const program = new Command()
  .name('aiqa')
  .description(
    'AI-QA-Platform tools: generate tests, read run history, make test data, run agents, practise interviews',
  );

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

program
  .command('quiz')
  .description('interview questions from the learning path: answer, reveal the outline, mark yourself')
  .addOption(new Option('--topic <topic>', 'only this topic').choices(TOPICS))
  .addOption(new Option('--level <level>', 'only this level').choices(LEVELS))
  .option('--count <n>', 'how many questions', positiveInt, 10)
  .option('--seed <n>', 'seed for a repeatable selection', positiveInt)
  .option('--list', 'print the questions with their answers, no prompts')
  .option('--coverage', 'how many questions each topic has')
  .action(
    async (opts: {
      topic?: Topic;
      level?: Level;
      count: number;
      seed?: number;
      list?: boolean;
      coverage?: boolean;
    }) => {
      if (opts.coverage) return console.log(formatCoverage());
      const pick = { topic: opts.topic, level: opts.level, count: opts.count, seed: opts.seed };
      if (opts.list) return console.log(formatList(pickQuestions(pick)));
      await runQuiz(pick); // practice, not a gate: the exit code stays 0 whatever the score
    },
  );

const agents = program.command('agents').description('run the AI agents and read their log');

agents
  .command('triage')
  .description('why each failed test of a run failed: product, test, flaky or environment')
  .option('--run <id>', 'a recorded run id (default: the latest run of the suite)')
  .option('--suite <suite>', 'the suite whose latest run to triage', 'ui')
  .option('--limit <n>', 'at most this many tests', positiveInt, 10)
  .action(async (opts: { run?: string; suite: string; limit: number }) => {
    const runs = loadRuns();
    const latest = runs
      .filter((r) => r.run.suite === opts.suite)
      .sort((a, b) => a.run.startedAt.localeCompare(b.run.startedAt))
      .at(-1);
    const runId = opts.run ?? latest?.run.id;
    if (!runId) return console.log(`No recorded "${opts.suite}" run. Run "pnpm test:${opts.suite}" first.`);
    const model = chooseModel(loadEnv());
    const log = new JsonlRunLog();
    const items = [];
    for (const ctx of buildTriageContexts(runs, runId).slice(0, opts.limit)) {
      items.push({
        ctx,
        verdict: await triage(ctx, {
          model,
          log,
          maxToolCalls: loadEnv().AGENT_MAX_TOOL_CALLS,
          timeoutMs: loadEnv().AGENT_TIMEOUT_MS,
        }),
      });
    }
    console.log(formatTriage(items, model.label));
  });

agents
  .command('eval')
  .description('score an agent against its labelled cases (exit code 1 below the sprint gate)')
  .addArgument(new Argument('<agent>', 'which agent').choices(['triage']))
  .option('--model-only', 'switch the rules off and measure the model alone')
  .option('--only <ids>', 'comma-separated case ids')
  .action(async (_agent: string, opts: { modelOnly?: boolean; only?: string }) => {
    const model = chooseModel(loadEnv());
    if (opts.modelOnly && !model.model) {
      throw new Error(
        '--model-only needs a model: set AI_ENABLED=true or AGENT_PROVIDER (see .env.example).',
      );
    }
    const report = await runTriageEval({
      model,
      skipRules: opts.modelOnly,
      log: new JsonlRunLog(),
      timeoutMs: loadEnv().AGENT_TIMEOUT_MS,
      only: opts.only?.split(',').map((s) => s.trim()),
    });
    const mode = opts.modelOnly ? 'model only' : model.model ? 'rules, then model' : 'rules only';
    console.log(formatEval(`triage (${mode}, ${model.label})`, report));
    console.log(`
Gate: ${Math.round(TRIAGE_GATE * 100)}% ${report.accuracy >= TRIAGE_GATE ? 'passed' : 'not reached'}`);
    if (report.accuracy < TRIAGE_GATE) process.exitCode = 1;
  });

agents
  .command('plan')
  .description('write a test plan for one page from its accessibility tree (needs a model)')
  .argument('<name>', 'plan name, e.g. "inventory" -> specs/inventory.plan.md')
  .addOption(new Option('--target <target>', 'demo target').choices(targetNames).default('saucedemo'))
  .option('--path <path>', 'path relative to the target base URL', '/')
  .option(
    '--logged-in',
    'open the page with the SauceDemo session the UI suite saves (run pnpm test:ui once first)',
  )
  .option('--focus <text>', 'what the plan should concentrate on')
  .action(
    async (name: string, opts: { target: string; path: string; loggedIn?: boolean; focus?: string }) => {
      const url = new URL(opts.path, targetUrl(opts.target as TargetName)).toString();
      if (opts.loggedIn && !fs.existsSync(SAUCE_SESSION)) {
        throw new Error(
          `No saved session at ${SAUCE_SESSION}. Run "pnpm test:ui --project=auth" once first.`,
        );
      }
      console.log(`Reading the accessibility tree of ${url}…`);
      const snapshot = await ariaSnapshotOf(url, opts.loggedIn ? SAUCE_SESSION : undefined);
      const model = chooseModel(loadEnv());
      console.log(`Asking ${model.label} for a plan (a local model on CPU takes a few minutes)…`);
      const result = await planPage(
        { name, url, snapshot, focus: opts.focus, seed: 'tests/seed.spec.ts' },
        { model, log: new JsonlRunLog(), timeoutMs: loadEnv().AGENT_TIMEOUT_MS },
      );
      if (!result.markdown) throw new Error(result.reason);
      const file = path.join(FRAMEWORK, 'specs', `${slug(name)}.plan.md`);
      fs.writeFileSync(file, result.markdown);
      console.log(
        `wrote packages/playwright-framework/specs/${path.basename(file)} (${result.plan!.scenarios.length} scenarios)`,
      );
      console.log(`Next: review it, then "pnpm aiqa agents generate specs/${path.basename(file)}".`);
    },
  );

agents
  .command('generate')
  .description("write specs for a plan's scenarios; each must lint clean and pass N runs in a row")
  .argument('<plan>', 'plan file, relative to packages/playwright-framework, e.g. specs/inventory.plan.md')
  .option('--scenario <n>', 'only this scenario number', positiveInt)
  .option('--runs <n>', 'runs in a row a spec must pass', positiveInt, 3)
  .action(async (planFile: string, opts: { scenario?: number; runs: number }) => {
    const plan = parsePlan(fs.readFileSync(path.join(FRAMEWORK, planFile), 'utf8'));
    const model = chooseModel(loadEnv());
    if (!model.model) throw new Error('The generator needs a model: set AI_ENABLED=true or AGENT_PROVIDER.');
    const url = /^Page: (\S+)/m.exec(fs.readFileSync(path.join(FRAMEWORK, planFile), 'utf8'))?.[1] ?? '';
    const examples = ['tests/seed.spec.ts', 'tests/journeys/checkout.spec.ts'].map((p) => ({
      path: p,
      code: fs.readFileSync(path.join(FRAMEWORK, p), 'utf8'),
    }));
    const chosen = plan.scenarios
      .map((scenario, i) => ({ scenario, n: i + 1 }))
      .filter(({ n }) => !opts.scenario || n === opts.scenario);
    for (const { scenario, n } of chosen) {
      const file = `tests/generated/${slug(scenario.title)}.spec.ts`;
      console.log(`\nScenario ${n}: ${scenario.title}`);
      const result = await generateSpec(
        { scenario, file, examples, url },
        specCheck(FRAMEWORK, file, opts.runs),
        { model, log: new JsonlRunLog(), timeoutMs: loadEnv().AGENT_TIMEOUT_MS },
      );
      if (result.status === 'passed') {
        console.log(
          `  PASSED ${opts.runs} runs in a row after ${result.attempts} attempt(s): packages/playwright-framework/${file}`,
        );
      } else {
        // A failing spec does not stay in the suite: it is kept for review outside the test folders.
        const rejected = path.join(FRAMEWORK_STATE, 'agents', 'rejected', path.basename(file));
        fs.mkdirSync(path.dirname(rejected), { recursive: true });
        if (result.code) fs.writeFileSync(rejected, result.code);
        fs.rmSync(path.join(FRAMEWORK, file), { force: true });
        console.log(
          `  FAILED after ${result.attempts} attempt(s); kept for review at ${path.relative(process.cwd(), rejected)}`,
        );
        console.log(
          (result.errors ?? '')
            .split('\n')
            .slice(0, 12)
            .map((l) => `    ${l}`)
            .join('\n'),
        );
        process.exitCode = 1;
      }
    }
  });

agents
  .command('heal-review')
  .description('turn healed locators into reviewable patches with a pull-request description')
  .option('--apply', 'ask, patch by patch, whether to write it')
  .action(async (opts: { apply?: boolean }) => {
    const repo = createHealRepository(FRAMEWORK_STATE);
    const events = repo.listEvents();
    repo.close();
    const reviews = await reviewHeals(events, {
      root: FRAMEWORK,
      sources: readPatchableSources(FRAMEWORK),
      model: chooseModel(loadEnv()),
      apply: opts.apply,
      approve: async (call) => {
        const input = call.input as { diff: string };
        console.log(`\n${input.diff}`);
        return askOnTerminal('Write this patch?');
      },
      log: new JsonlRunLog(),
      timeoutMs: loadEnv().AGENT_TIMEOUT_MS,
    });
    console.log(formatHealingReviews(reviews));
  });

agents
  .command('log')
  .description('the agent run log, newest first')
  .option('--limit <n>', 'how many runs', positiveInt, 20)
  .action((opts: { limit: number }) => console.log(formatAgentLog(new JsonlRunLog().read(opts.limit))));

program.parseAsync().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
