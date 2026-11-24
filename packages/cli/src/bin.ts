import path from 'node:path';
import { PROJECT_KINDS, renderProject, writeProject, type ProjectKind } from '@aiqa/templates';
import { changedTrackedFiles, commitHealBranch, writeHealPatches } from './commands/heal-branch';
import { formatPlanScore, HEAL_TASK, HEAL_TASK_FILE, scoreHeal, scorePlan } from './commands/compare';
import { chromium } from '@playwright/test';
import { targetNames, targetUrl, type TargetName } from '@aiqa/shared';
import { Argument, Command, InvalidArgumentError, Option } from 'commander';
import { ENTITIES, makeData, type Entity } from './commands/data';
import { formatFlaky, formatHistory, formatPerf, loadRuns } from './commands/history';
import { formatFiles, renderPage, writeFiles } from './commands/new-page';
import { formatList, runQuiz } from './commands/quiz';
import { changedFiles, formatSelection } from './commands/select';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import {
  createRunRepository,
  HISTORY_DIR,
  metricTrends,
  renderPdfReport,
  reportInput,
  type ResultRecord,
} from '@aiqa/reporting-engine';
import {
  askOnTerminal,
  rerunTest,
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
  AGENT_EVALS,
  edgeCaseData,
  errorSummary,
  generateSpec,
  huntFlaky,
  buildImportGraph,
  JsonlDecisionStore,
  JsonlRunLog,
  fileKind,
  formatReviewMarkdown,
  readImpactMap,
  reviewSpec,
  runCommands,
  selectTests,
  specHistory,
  planApiTests,
  TRIAGE_LABELS,
  triageDecision,
  type TriageLabel,
  rankA11yFindings,
  renderApiSpec,
  reportRun,
  runFacts,
  parsePlan,
  planPage,
  reviewHeals,
  runTriageEval,
  triage,
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
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

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
  .command('report')
  .description('the run history as a PDF report (the dashboard, printed by Chromium)')
  .argument('[format]', 'pdf', 'pdf')
  .option('--suite <suite>', 'only this suite, e.g. ui, api, load, agents')
  .option('--limit <n>', 'how many recent runs to read', positiveInt, 50)
  .option('--title <title>', 'title on the first page and in the footer')
  .option('--out <file>', 'where to write it (default .aiqa/reports/test-report-<date>.pdf)')
  .action(async (format: string, opts: { suite?: string; limit: number; title?: string; out?: string }) => {
    if (format !== 'pdf') throw new Error(`Unknown format "${format}". Only pdf for now.`);
    const runs = loadRuns(HISTORY_DIR, opts.limit);
    const { runs: chosen } = reportInput(runs, opts);
    if (chosen.length === 0)
      throw new Error(
        `No recorded runs${opts.suite ? ` for suite "${opts.suite}"` : ''}. Run a suite first.`,
      );
    const out = path.resolve(
      opts.out ??
        path.join(REPO_ROOT, '.aiqa', 'reports', `test-report-${new Date().toISOString().slice(0, 10)}.pdf`),
    );
    const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
    try {
      const pdf = await renderPdfReport(browser, runs, opts);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, pdf);
      console.log(
        `wrote ${path.relative(process.cwd(), out)} (${chosen.length} runs, ${Math.round(pdf.length / 1024)} KB)`,
      );
    } finally {
      await browser.close();
    }
  });

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
  .command('select')
  .description(
    'risk-based test selection: the specs a change can affect, riskiest first, with the reason for each',
  )
  .option(
    '--base <ref>',
    'compare with this branch or commit (the files a pull request would contain)',
    'origin/main',
  )
  .option('--files <paths...>', 'these changed files instead of asking git (repository-relative)')
  .option(
    '--budget <minutes>',
    'stop adding specs past this estimated time (changed specs always run)',
    Number,
  )
  .option('--no-model', 'rules only, even when a model is configured')
  .option('--wide', 'also run specs that load the changed code through a shared file without using it')
  .option('--run', 'run the selected specs now')
  .option('--json', 'print the selection as JSON (for CI)')
  .action(
    async (opts: {
      base: string;
      files?: string[];
      budget?: number;
      model: boolean;
      wide?: boolean;
      run?: boolean;
      json?: boolean;
    }) => {
      const root = path.resolve(FRAMEWORK, '..', '..');
      const change = opts.files
        ? { files: opts.files, diff: '', base: '(given)' }
        : changedFiles(root, opts.base);
      const model = opts.model ? chooseModel(loadEnv()) : undefined;
      const result = await selectTests(change.files, {
        root,
        graph: buildImportGraph(root),
        impact: readImpactMap(root),
        history: specHistory(loadRuns(undefined, 200)),
        budgetMs: opts.budget !== undefined ? opts.budget * 60_000 : undefined,
        includeShared: opts.wide,
        diff: change.diff,
        model,
        log: new JsonlRunLog(),
        timeoutMs: loadEnv().AGENT_TIMEOUT_MS,
      });
      const commands = runCommands(root, result.selected);
      if (opts.json) return console.log(JSON.stringify({ ...result, commands }, null, 2));
      console.log(formatSelection(result, commands, model?.label ?? 'off'));
      if (opts.run) {
        if (result.everything)
          return console.log('\nEverything is affected: run "pnpm test:ui" and the other suites.');
        for (const command of commands) {
          console.log(`\n> ${command}`);
          const r = spawnSync(command, { cwd: root, stdio: 'inherit', shell: true });
          if (r.status !== 0) process.exitCode = r.status ?? 1;
        }
      }
    },
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
          memory: new JsonlDecisionStore(),
          maxToolCalls: loadEnv().AGENT_MAX_TOOL_CALLS,
          timeoutMs: loadEnv().AGENT_TIMEOUT_MS,
        }),
      });
    }
    console.log(formatTriage(items, model.label));
  });

agents
  .command('eval')
  .description('score agents on their labelled cases with the configured model (exit code 1 below a gate)')
  .argument('<agent>', `one of: all, generator, ${AGENT_EVALS.map((e) => e.agent).join(', ')}`)
  .option('--model-only', 'triage only: switch the rules off and measure the model alone')
  .option('--record', 'save the scores to the run history as suite "agents"')
  .action(async (which: string, opts: { modelOnly?: boolean; record?: boolean }) => {
    const env = loadEnv();
    const model = chooseModel(env);
    if (!model.model)
      throw new Error(
        'Agent evals measure the model: set AI_ENABLED=true or AGENT_PROVIDER (see .env.example).',
      );
    const names = which === 'all' ? [...AGENT_EVALS.map((e) => e.agent), 'generator'] : [which];
    const unknown = names.filter((n) => n !== 'generator' && !AGENT_EVALS.some((e) => e.agent === n));
    if (unknown.length) throw new Error(`No eval for ${unknown.join(', ')}.`);
    const log = new JsonlRunLog();
    const ctx = { model, log, timeoutMs: env.AGENT_TIMEOUT_MS, openApi: undefined as unknown };
    if (names.includes('api-tester')) {
      try {
        ctx.openApi = await (
          await fetch(`${process.env.ORDER_SERVICE_URL ?? 'http://localhost:8088'}/openapi.json`)
        ).json();
      } catch {
        console.log('api-tester: skipped, the order service is not running ("pnpm stack:up").');
        names.splice(names.indexOf('api-tester'), 1);
      }
    }
    const started = new Date().toISOString();
    const results: ResultRecord[] = [];
    const runId = randomUUID();
    let below = 0;
    for (const name of names) {
      const began = Date.now();
      console.log(`\n${name}: running…`);
      let total = 0;
      let correct = 0;
      let gate = 0.8;
      if (name === 'generator') {
        // Needs a browser and SauceDemo: scenario 1 of the checked-in plan must pass 3 runs.
        const plan = parsePlan(fs.readFileSync(path.join(FRAMEWORK, 'specs/inventory.plan.md'), 'utf8'));
        const file = 'tests/generated/eval-generator.spec.ts';
        const examples = [
          'tests/seed.spec.ts',
          'tests/journeys/checkout.spec.ts',
          'src/pages/saucedemo/inventory.page.ts',
        ].map((p) => ({
          path: p,
          code: fs.readFileSync(path.join(FRAMEWORK, p), 'utf8'),
        }));
        const result = await generateSpec(
          { scenario: plan.scenarios[0]!, file, examples, url: 'https://www.saucedemo.com/inventory.html' },
          specCheck(FRAMEWORK, file, 3),
          ctx,
        );
        // A failed spec is kept for review outside the test folders, as `agents generate` does.
        if (result.status !== 'passed' && result.code) {
          const rejected = path.join(
            FRAMEWORK_STATE,
            'agents',
            'rejected',
            `eval-generator-${Date.now()}.spec.ts`,
          );
          fs.mkdirSync(path.dirname(rejected), { recursive: true });
          fs.writeFileSync(rejected, result.code);
          console.log(
            `  kept for review at ${path.relative(process.cwd(), rejected)}\n  ${errorSummary(result.errors)}`,
          );
        }
        fs.rmSync(path.join(FRAMEWORK, file), { force: true });
        total = 1;
        correct = result.status === 'passed' ? 1 : 0;
        console.log(`generator: ${result.status} after ${result.attempts} attempt(s)`);
        results.push({
          runId,
          testId: 'generator:inventory-1',
          retry: 0,
          title: 'generator › inventory scenario 1 passes 3 runs',
          file: 'agents/generator',
          project: model.label,
          status: correct ? 'passed' : 'failed',
          durationMs: Date.now() - began,
          errorMessage: result.status === 'passed' ? undefined : errorSummary(result.errors),
        });
      } else {
        const e = AGENT_EVALS.find((x) => x.agent === name)!;
        gate = e.gate;
        const report =
          name === 'triage' && opts.modelOnly
            ? await runTriageEval({ ...ctx, skipRules: true })
            : await e.run(ctx);
        total = report.total;
        correct = report.correct;
        console.log(formatEval(`${name} (${e.measures})`, report));
        const seen = new Map<string, number>(); // the run history keys results by test id: keep them unique
        for (const o of report.outcomes) {
          const n = (seen.get(o.id) ?? 0) + 1;
          seen.set(o.id, n);
          const id = n === 1 ? o.id : `${o.id} (${n})`;
          results.push({
            runId,
            testId: `${name}:${id}`,
            retry: 0,
            title: `${name} › ${id}`,
            file: `agents/${name}`,
            project: model.label,
            status: o.correct ? 'passed' : 'failed',
            durationMs: 0,
            errorMessage: o.correct ? undefined : `expected ${o.expected}, got ${o.actual} (${o.source})`,
          });
        }
      }
      const accuracy = total ? correct / total : 0;
      const ok = accuracy >= gate;
      if (!ok) below++;
      console.log(
        `${name}: ${correct}/${total} = ${Math.round(accuracy * 100)}%, gate ${Math.round(gate * 100)}% ${ok ? 'passed' : 'NOT reached'} (${((Date.now() - began) / 60000).toFixed(1)} min)`,
      );
      results.push({
        runId,
        testId: `${name}:gate`,
        retry: 0,
        title: `${name} › gate`,
        file: `agents/${name}`,
        project: model.label,
        status: ok ? 'passed' : 'failed',
        durationMs: Date.now() - began,
        metrics: { accuracy_pct: Math.round(accuracy * 1000) / 10 },
      });
    }
    if (opts.record) {
      const repo = createRunRepository(HISTORY_DIR); // the reporter's own writable store
      repo.saveRun({
        run: {
          id: runId,
          suite: 'agents',
          startedAt: started,
          finishedAt: new Date().toISOString(),
          environment: model.label,
        },
        results,
      });
      repo.close();
      console.log(`\nRecorded as run ${runId} in the run history (suite "agents").`);
    }
    if (below) process.exitCode = 1;
  });

agents
  .command('flaky')
  .description('find flaky tests in the history, rerun them, and say the likely cause and fix')
  .option('--suite <suite>', "which suite's history", 'ui')
  .option('--rerun <n>', 'rerun each candidate n times (0 = history only)', (v) => Number(v), 5)
  .option('--limit <n>', 'at most this many tests', positiveInt, 5)
  .action(async (opts: { suite: string; rerun: number; limit: number }) => {
    const env = loadEnv();
    const runs = loadRuns().filter((r) => r.run.suite === opts.suite);
    const findings = await huntFlaky(runs, {
      model: chooseModel(env),
      log: new JsonlRunLog(),
      timeoutMs: env.AGENT_TIMEOUT_MS,
      limit: opts.limit,
      rerun:
        opts.rerun > 0
          ? async (t) => {
              console.log(`rerunning "${t.title}" ${opts.rerun} times…`);
              return rerunTest(path.resolve(FRAMEWORK, '..'), opts.suite, t.title, opts.rerun);
            }
          : undefined,
    });
    if (!findings.length) return console.log(`No flaky tests in the last runs of "${opts.suite}".`);
    for (const f of findings) {
      console.log(
        `\n${f.verdict.toUpperCase().padEnd(10)} ${f.test.title}  (cause: ${f.diagnosis.cause}, ${f.diagnosis.source})`,
      );
      console.log(`  ${f.diagnosis.explanation}\n  fix: ${f.diagnosis.fix}`);
    }
  });

agents
  .command('data')
  .description('edge-case records for an entity: model proposals that pass the schema, builders for the rest')
  .addArgument(new Argument('<entity>', 'entity').choices(['product', 'customer']))
  .action(async (entity: 'product' | 'customer') => {
    const env = loadEnv();
    const result = await edgeCaseData(entity, {
      model: chooseModel(env),
      log: new JsonlRunLog(),
      timeoutMs: env.AGENT_TIMEOUT_MS,
    });
    console.log(JSON.stringify(result.records, null, 2));
    console.error(
      `\n${result.modelProposed} proposed by the model, ${result.rejected.length} rejected by the schema, ${result.records.filter((r) => r.source === 'builder').length} built by code for edges the model missed.`,
    );
    for (const r of result.rejected) console.error(`  rejected: ${r.problem}`);
  });

agents
  .command('a11y')
  .description('scan a page with axe and rank the findings by what users cannot do')
  .addOption(new Option('--target <target>', 'demo target').choices(targetNames).default('saucedemo'))
  .option('--path <path>', 'path relative to the target base URL', '/')
  .option('--logged-in', 'open the page with the saved SauceDemo session')
  .action(async (opts: { target: string; path: string; loggedIn?: boolean }) => {
    const env = loadEnv();
    const url = new URL(opts.path, targetUrl(opts.target as TargetName)).toString();
    const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
    let findings;
    try {
      const page = await browser.newPage({ storageState: opts.loggedIn ? SAUCE_SESSION : undefined });
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
        .analyze();
      findings = results.violations.map((v) => ({
        id: v.id,
        impact: v.impact ?? 'unknown',
        help: v.help,
        nodes: v.nodes.length,
        page: url,
      }));
    } finally {
      await browser.close();
    }
    if (!findings.length) return console.log(`axe found nothing on ${url}.`);
    const ranked = await rankA11yFindings(findings, {
      model: chooseModel(env),
      log: new JsonlRunLog(),
      timeoutMs: env.AGENT_TIMEOUT_MS,
    });
    for (const r of ranked)
      console.log(
        `${r.priority.padEnd(9)} ${r.id} (${r.impact}, ${r.nodes} element${r.nodes === 1 ? '' : 's'}, ${r.source})\n          ${r.userImpact}`,
      );
  });

agents
  .command('report')
  .description(
    'a short summary of the latest run of a suite for a person; every number checked against the history',
  )
  .option('--suite <suite>', 'suite', 'ui')
  .action(async (opts: { suite: string }) => {
    const env = loadEnv();
    const runs = loadRuns();
    const latest = runs
      .filter((r) => r.run.suite === opts.suite)
      .sort((a, b) => a.run.startedAt.localeCompare(b.run.startedAt))
      .at(-1);
    const labels: Record<string, string> = {};
    if (latest)
      for (const ctx of buildTriageContexts(runs, latest.run.id))
        labels[ctx.testId] = (await triage(ctx)).label;
    const facts = runFacts(runs, opts.suite, labels);
    if (!facts) return console.log(`No recorded "${opts.suite}" run.`);
    const report = await reportRun(facts, {
      model: chooseModel(env),
      log: new JsonlRunLog(),
      timeoutMs: env.AGENT_TIMEOUT_MS,
    });
    console.log(report.markdown);
    if (report.reason) console.error(`\n(template used: ${report.reason})`);
  });

agents
  .command('api-tests')
  .description('write API cases for the order service from its OpenAPI document into the data suite')
  .option('--run', 'run the written spec against the stack afterwards')
  .action(async (opts: { run?: boolean }) => {
    const env = loadEnv();
    const base = process.env.ORDER_SERVICE_URL ?? 'http://localhost:8088';
    const document = await (await fetch(`${base}/openapi.json`)).json();
    const plan = await planApiTests(document, {
      model: chooseModel(env),
      log: new JsonlRunLog(),
      timeoutMs: env.AGENT_TIMEOUT_MS,
    });
    const dataFramework = path.resolve(FRAMEWORK, '..', 'data-framework');
    const file = path.join(dataFramework, 'tests', 'generated', 'order-service-api.spec.ts');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, renderApiSpec(plan.cases, 'Order service API, generated'));
    console.log(
      `wrote packages/data-framework/tests/generated/order-service-api.spec.ts: ${plan.cases.length} cases (${plan.cases.filter((c) => c.source === 'model').length} from the model, ${plan.cases.filter((c) => c.source === 'rules').length} added by code)`,
    );
    for (const r of plan.rejected) console.log(`  rejected "${r.case.name}": ${r.problem}`);
    if (opts.run) {
      const playwright = require.resolve('@playwright/test/cli', { paths: [dataFramework] });
      const run = spawnSync(
        process.execPath,
        [playwright, 'test', 'tests/generated/order-service-api.spec.ts', '--reporter=line'],
        { cwd: dataFramework, stdio: 'inherit' },
      );
      process.exitCode = run.status ?? 1;
    }
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
    const examples = [
      'tests/seed.spec.ts',
      'tests/journeys/checkout.spec.ts',
      'src/pages/saucedemo/inventory.page.ts',
    ].map((p) => ({
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

const newProject = program.commands.find((c) => c.name() === 'new');
newProject
  ?.command('project')
  .description('start a standalone Playwright project from a template (ui, api or both)')
  .argument('<name>', 'npm package name, also the folder name, e.g. "checkout-tests"')
  .addOption(new Option('--kind <kind>', 'which suites').choices([...PROJECT_KINDS]).default('both'))
  .option('--dir <dir>', 'where to create it (default: ./<name>)')
  .option('--force', 'write into a folder that is not empty')
  .action((name: string, opts: { kind: ProjectKind; dir?: string; force?: boolean }) => {
    const dir = path.resolve(opts.dir ?? name);
    const files = renderProject({ name, kind: opts.kind });
    writeProject(dir, files, { force: opts.force });
    console.log(`Created ${opts.kind} project "${name}" in ${dir} (${files.length} files).\n`);
    console.log(`  cd ${path.relative(process.cwd(), dir) || '.'}`);
    console.log('  npm install');
    console.log('  npx playwright install chromium');
    console.log('  npm test');
  });

agents
  .command('heal-review')
  .description('turn healed locators into reviewable patches with a pull-request description')
  .option('--apply', 'ask, patch by patch, whether to write it')
  .option('--branch', 'with --apply: commit the written patches on a new local heal/* branch (you push it)')
  .option('--package <name>', 'whose heals: ui (page objects) or mobile (screen objects)', 'ui')
  .action(async (opts: { apply?: boolean; branch?: boolean; package: string }) => {
    if (opts.package !== 'ui' && opts.package !== 'mobile')
      throw new Error(`--package must be ui or mobile, not "${opts.package}"`);
    const framework =
      opts.package === 'mobile' ? path.resolve(FRAMEWORK, '..', 'mobile-framework') : FRAMEWORK;
    const root = path.resolve(framework, '..', '..');
    const packagePath = path.relative(root, framework);
    if (opts.branch) {
      if (!opts.apply) throw new Error('--branch needs --apply: only written patches can be committed.');
      // Checked before anything is written, so the branch holds the heal fixes and nothing else.
      const dirty = changedTrackedFiles(root).filter((f) => f.startsWith(packagePath.replaceAll('\\', '/')));
      if (dirty.length)
        throw new Error(
          `Commit or stash these changes first, so the heal branch holds only heal fixes:\n  ${dirty.join('\n  ')}`,
        );
    }
    const repo = createHealRepository(path.join(framework, '.aiqa'));
    const events = repo.listEvents();
    repo.close();
    const reviews = await reviewHeals(events, {
      root: framework,
      sources: readPatchableSources(framework),
      model: chooseModel(loadEnv()),
      apply: opts.apply,
      approve: async (call) => {
        const input = call.input as { diff: string };
        console.log(`\n${input.diff}`);
        return askOnTerminal('Write this patch?');
      },
      log: new JsonlRunLog(),
      timeoutMs: loadEnv().AGENT_TIMEOUT_MS,
      memory: new JsonlDecisionStore(),
      reviewer: reviewer(),
    });
    console.log(formatHealingReviews(reviews));
    const written = writeHealPatches(reviews, path.join(root, '.aiqa', 'heal-patches'), packagePath);
    if (written.length)
      console.log(`\nPatches and descriptions: ${path.join('.aiqa', 'heal-patches')} (${written.length})`);
    if (opts.branch) {
      const applied = reviews.filter((r) => r.status === 'applied');
      if (!applied.length) return console.log('No patch was approved, so no branch was made.');
      const branch = commitHealBranch(root, applied, packagePath);
      console.log(
        `\nCommitted on ${branch}. Review it, then: git push -u origin ${branch}  (and open the pull request with the .md text).\nBack to where you were: git switch -`,
      );
    }
  });

agents
  .command('review')
  .description(
    "review changed specs and page objects against CONTRIBUTING's coding standards (exit code 1 on a must-fix)",
  )
  .option('--base <ref>', 'review the files changed since this branch or commit', 'origin/main')
  .option('--files <paths...>', 'review these files instead (repository-relative)')
  .option('--no-model', 'rules only, even when a model is configured')
  .option('--markdown <file>', 'also write the review as Markdown, for a pull-request comment')
  .action(async (opts: { base: string; files?: string[]; model: boolean; markdown?: string }) => {
    const root = path.resolve(FRAMEWORK, '..', '..');
    const files = (opts.files ?? changedFiles(root, opts.base).files)
      .map((f) => f.replaceAll('\\', '/'))
      .filter((f) => fileKind(f) !== 'other' && fs.existsSync(path.join(root, f)));
    if (!files.length) return console.log('No changed specs or page objects to review.');
    const model = opts.model ? chooseModel(loadEnv()) : undefined;
    const log = new JsonlRunLog();
    const reviews = [];
    for (const file of files)
      reviews.push(
        await reviewSpec(file, fs.readFileSync(path.join(root, file), 'utf8'), {
          model,
          log,
          timeoutMs: loadEnv().AGENT_TIMEOUT_MS,
        }),
      );
    const markdown = formatReviewMarkdown(reviews);
    console.log(markdown.replace(/\*\*/g, '').replace(/^### /m, ''));
    const notes = reviews.filter((r) => r.modelNote).map((r) => `  ${r.file}: ${r.modelNote}`);
    if (notes.length && model?.model) console.log(`\nModel notes:\n${notes.join('\n')}`);
    if (opts.markdown) {
      fs.mkdirSync(path.dirname(path.resolve(opts.markdown)), { recursive: true });
      fs.writeFileSync(path.resolve(opts.markdown), markdown);
    }
    if (reviews.some((r) => r.findings.some((f) => f.severity === 'must'))) process.exitCode = 1;
  });

// Who is deciding, for the decision record: the git user, else the OS user.
function reviewer(): string {
  const git = spawnSync('git', ['config', 'user.name'], { encoding: 'utf8' }).stdout?.trim();
  return git || process.env.USERNAME || process.env.USER || 'reviewer';
}

const feedback = agents
  .command('feedback')
  .description("record a person's decision, so the agents answer the same way next time");

feedback
  .command('triage')
  .description('the real label of a failed test; triage answers from it next time this failure comes back')
  .argument('<test-id>', 'the id `aiqa agents triage` prints under each test')
  .addArgument(new Argument('<label>', 'what it really was').choices([...TRIAGE_LABELS]))
  .option('--run <id>', 'the run the failure is in (default: the latest run of the suite that has it)')
  .option('--note <text>', 'why, in a sentence: shown with the verdict and to the model')
  .action((testId: string, label: TriageLabel, opts: { run?: string; note?: string }) => {
    const runs = loadRuns()
      .filter((r) => !opts.run || r.run.id === opts.run)
      .sort((a, b) => a.run.startedAt.localeCompare(b.run.startedAt));
    const failure = runs
      .flatMap((r) => r.results)
      .filter((r) => r.testId === testId && r.errorMessage)
      .at(-1);
    if (!failure)
      throw new Error(`No recorded failure of test ${testId}${opts.run ? ` in run ${opts.run}` : ''}.`);
    const said = new JsonlRunLog()
      .read(500)
      .find((r) => r.agent === 'triage' && (r.input as { testId?: string }).testId === testId);
    const agentLabel = (said?.output as { label?: TriageLabel | 'unknown' } | undefined)?.label;
    const decision = triageDecision({
      testId,
      title: failure.title,
      errorMessage: failure.errorMessage ?? '',
      label,
      agentLabel,
      by: reviewer(),
      note: opts.note,
    });
    new JsonlDecisionStore().record(decision);
    console.log(
      `Recorded: "${failure.title}" is ${label}${agentLabel && agentLabel !== label ? ` (triage had said ${agentLabel})` : ''}.\n` +
        `The same failure is answered from this from now on; failures with the same error in other tests show it to the model.`,
    );
  });

feedback
  .command('list')
  .description('the decisions recorded so far, newest first')
  .action(() => {
    const all = new JsonlDecisionStore().all().reverse();
    if (!all.length) return console.log('No decisions recorded yet.');
    for (const d of all)
      console.log(
        d.kind === 'triage'
          ? `${d.at.slice(0, 16).replace('T', ' ')}  triage  ${d.label.padEnd(12)} ${d.title}  (${d.by})${d.note ? ` — ${d.note}` : ''}`
          : `${d.at.slice(0, 16).replace('T', ' ')}  heal    ${d.verdict.padEnd(12)} ${d.locatorKey}: ${d.suggestion}  (${d.by})`,
      );
  });

agents
  .command('log')
  .description('the agent run log, newest first')
  .option('--limit <n>', 'how many runs', positiveInt, 20)
  .action((opts: { limit: number }) => console.log(formatAgentLog(new JsonlRunLog().read(opts.limit))));

// Playwright's own planner, generator and healer against ours, on the same tasks and the same checks
// (docs/agents-vs-playwright.md). The Playwright agents run in Claude Code; these commands set the
// tasks up and score what either side produced.
const compare = agents
  .command('compare')
  .description("score Playwright's test agents and ours on the same tasks (docs/agents-vs-playwright.md)");

compare
  .command('plan')
  .description('score plans against the live page: every quoted element must be on it')
  .argument(
    '<plans...>',
    'plan files, relative to packages/playwright-framework, e.g. specs/inventory.plan.md',
  )
  .option('--logged-in', 'read the page with the saved SauceDemo session (pnpm test:ui --project=auth once)')
  .action(async (plans: string[], opts: { loggedIn?: boolean }) => {
    let failed = 0;
    for (const file of plans) {
      const markdown = fs.readFileSync(path.join(FRAMEWORK, file), 'utf8');
      const url =
        /^Page: (\S+)/m.exec(markdown)?.[1] ?? /https?:\/\/\S+/.exec(markdown)?.[0]?.replace(/[).,]+$/, '');
      if (!url) throw new Error(`${file} names no page (a "Page: <url>" line or any URL).`);
      const snapshot = await ariaSnapshotOf(url, opts.loggedIn ? SAUCE_SESSION : undefined);
      const score = scorePlan(markdown, snapshot);
      if (!score.passed) failed++;
      console.log(`${formatPlanScore(file, score)}\n  page: ${url}\n`);
    }
    process.exitCode = failed ? 1 : 0;
  });

compare
  .command('spec')
  .description('score a spec the way the generator eval does: lints clean and passes N runs in a row')
  .argument('<spec>', 'spec file, relative to packages/playwright-framework')
  .option('--runs <n>', 'runs in a row', positiveInt, 3)
  .action(async (file: string, opts: { runs: number }) => {
    const code = fs.readFileSync(path.join(FRAMEWORK, file), 'utf8');
    const result = await specCheck(FRAMEWORK, file, opts.runs)(code, 1);
    console.log(
      result.ok
        ? `${file}: PASS (lint clean, ${opts.runs} runs in a row)`
        : `${file}: FAIL\n${result.errors}`,
    );
    process.exitCode = result.ok ? 0 : 1;
  });

compare
  .command('heal-task')
  .description(`write the healing task (a spec whose locator broke) to ${HEAL_TASK_FILE}`)
  .action(() => {
    const target = path.join(FRAMEWORK, HEAL_TASK_FILE);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, HEAL_TASK);
    console.log(
      `wrote packages/playwright-framework/${HEAL_TASK_FILE}: it fails until its locator is fixed.\n` +
        'Give it to a healer, then score the result with "pnpm aiqa agents compare heal".',
    );
  });

compare
  .command('heal')
  .description('score the healed task: it passes 3 runs, the broken locator is gone, no assertion changed')
  .action(async () => {
    const target = path.join(FRAMEWORK, HEAL_TASK_FILE);
    if (!fs.existsSync(target))
      throw new Error('No healing task: run "pnpm aiqa agents compare heal-task" first.');
    const healed = fs.readFileSync(target, 'utf8');
    const run = await specCheck(FRAMEWORK, HEAL_TASK_FILE, 3)(healed, 1);
    const score = scoreHeal(healed, run.ok);
    console.log(`heal task: ${score.passed ? 'PASS' : 'FAIL'}`);
    console.log(`  runs 3 in a row, lint clean: ${run.ok ? 'yes' : 'no'}`);
    console.log(`  broken locator replaced:     ${score.locatorChanged ? 'yes' : 'no'}`);
    console.log(
      `  assertions untouched:        ${score.assertionsTouched.length ? `no: ${score.assertionsTouched.join(' | ')}` : 'yes'}`,
    );
    // The task never stays in the suite: the healed copy is kept for review outside the test folders.
    const kept = path.join(FRAMEWORK_STATE, 'agents', 'compare', `heal-task-${Date.now()}.spec.ts`);
    fs.mkdirSync(path.dirname(kept), { recursive: true });
    fs.renameSync(target, kept);
    console.log(`  kept at ${path.relative(process.cwd(), kept)}`);
    process.exitCode = score.passed ? 0 : 1;
  });

program.parseAsync().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
