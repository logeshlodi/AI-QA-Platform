#!/usr/bin/env node
// Frames for the README's demo GIF, from this machine's real output: each command is run, its
// output drawn as a terminal window, and the run-history dashboard captured. Frames go to
// .aiqa/demo/; with ffmpeg on the PATH they are also joined into docs/assets/demo.gif.
//
//   node scripts/demo-frames.mjs
//
// Needs: pnpm install, a browser (pnpm browsers), and at least one recorded run (e.g. pnpm test:api).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
// The repository root does not depend on Playwright; the framework package does.
const { chromium } = createRequire(path.join(root, 'packages', 'playwright-framework', 'package.json'))(
  '@playwright/test',
);
const out = path.join(root, '.aiqa', 'demo');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const ANSI = /\u001b\[[0-9;]*m/g;
const escape = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// The CLI runs through this node and tsx directly: a shell's `pnpm` can be another install's
// corepack shim (nvm on Windows) that fails before the command starts.
const tsxCli = createRequire(path.join(root, 'package.json')).resolve('tsx/cli');
const AIQA = `"${process.execPath}" "${tsxCli}" packages/cli/src/bin.ts`;

function run(command) {
  const r = spawnSync(command.replace(/^pnpm -s aiqa\b/, AIQA), {
    cwd: root,
    shell: true,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  return `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(ANSI, '').trimEnd();
}

/** A terminal window: the command, then the first lines of what it printed. */
function terminal(title, command, output, maxLines = 30) {
  const lines = output.split('\n');
  const shown = lines.slice(0, maxLines).join('\n') + (lines.length > maxLines ? '\n…' : '');
  return `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:#0d1117;font:15px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;color:#e6edf3}
  .bar{background:#161b22;padding:10px 16px;color:#8b949e;font-family:system-ui,sans-serif;font-size:14px}
  .bar b{color:#e6edf3}
  pre{margin:0;padding:18px 20px;white-space:pre-wrap;word-break:break-word}
  .cmd{color:#7ee787} .cmd::before{content:'$ ';color:#8b949e}
  </style><div class="bar"><b>${escape(title)}</b></div><pre><span class="cmd">${escape(command)}</span>
${escape(shown)}</pre>`;
}

const DEMO_SPEC = 'packages/playwright-framework/tests/journeys/zz-demo-review.spec.ts';
const scenes = [
  {
    title: '1 · Which tests can this change break? (risk-based selection)',
    command: 'pnpm aiqa select --files packages/playwright-framework/src/pages/saucedemo/cart.page.ts',
    run: 'pnpm -s aiqa select --no-model --files packages/playwright-framework/src/pages/saucedemo/cart.page.ts',
  },
  {
    title: '2 · A new spec reviewed against CONTRIBUTING, by line',
    command: `pnpm aiqa agents review --files ${DEMO_SPEC}`,
    before: () =>
      fs.writeFileSync(
        path.join(root, DEMO_SPEC),
        [
          "import { expect, test } from '@playwright/test';",
          '',
          "test('test 1', async ({ page }) => {",
          "  await page.goto('/inventory.html');",
          '  await page.waitForTimeout(2000);',
          '  await page.locator(\'//button[text()="Add to cart"]\').first().click();',
          "  await expect(page.locator('.shopping_cart_badge')).toHaveText('1');",
          '});',
          '',
        ].join('\n'),
      ),
    run: `pnpm -s aiqa agents review --no-model --files ${DEMO_SPEC}`,
    after: () => fs.rmSync(path.join(root, DEMO_SPEC), { force: true }),
  },
  {
    title: '3 · Why did it fail? Triage, rules first',
    command: 'pnpm aiqa agents triage --suite ui --limit 2',
    run: 'pnpm -s aiqa agents triage --suite ui --limit 2',
  },
  {
    title: '4 · Tests that pass and fail on the same code',
    command: 'pnpm aiqa flaky',
    run: 'pnpm -s aiqa flaky',
  },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 720 } });
let n = 0;
for (const scene of scenes) {
  scene.before?.();
  try {
    const output = run(scene.run);
    await page.setContent(terminal(scene.title, scene.command, output));
    await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, '0')}.png`) });
    console.log(`frame ${n}: ${scene.title}`);
  } finally {
    scene.after?.();
  }
}
const dashboard = path.join(root, '.aiqa', 'dashboard', 'index.html');
if (fs.existsSync(dashboard)) {
  await page.goto(`file://${dashboard.replaceAll('\\', '/')}`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, '0')}.png`) });
  console.log(`frame ${n}: the run-history dashboard`);
}
await browser.close();

const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
if (ffmpeg.status !== 0) {
  console.log(
    `\n${n} frames in ${path.relative(root, out)}. No ffmpeg here, so no GIF: join them elsewhere.`,
  );
} else {
  const gif = path.join(root, 'docs', 'assets', 'demo.gif');
  fs.mkdirSync(path.dirname(gif), { recursive: true });
  const filter =
    'fps=1/4,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer';
  const r = spawnSync(
    'ffmpeg',
    ['-y', '-framerate', '1/4', '-i', path.join(out, '%02d.png'), '-vf', filter, '-loop', '0', gif],
    {
      encoding: 'utf8',
    },
  );
  console.log(
    r.status === 0 ? `\nGIF: ${path.relative(root, gif)}` : `\nffmpeg failed:\n${r.stderr.slice(-500)}`,
  );
}
