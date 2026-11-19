import { detectFlaky, outcomesOf, slowest, summarize, type RunSummary, type TestOutcome } from './analysis';
import type { StoredRun } from './types';

/** Every string that reaches the page goes through this: titles and error text are untrusted. */
const esc = (value: unknown): string =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

const when = (iso: string): string => iso.replace('T', ' ').slice(0, 16);
const seconds = (ms: number): string =>
  ms >= 60_000 ? `${(ms / 60_000).toFixed(1)} min` : `${(ms / 1000).toFixed(1)} s`;
const firstLine = (text = ''): string => (text.split('\n').find((line) => line.trim()) ?? '').slice(0, 200);

/** Rounds up to 1, 2, 2.5 or 5 times a power of ten: an axis top a person can read. */
function niceCeil(value: number): number {
  const power = 10 ** Math.floor(Math.log10(value));
  return ([1, 2, 2.5, 5, 10].find((step) => step * power >= value) ?? 10) * power;
}

interface Point {
  value: number;
  tip: string;
}

/** A single-series line chart as inline SVG: 2px line, 8px markers, quiet grid, last value labelled. */
function lineChart(
  points: Point[],
  [min, max]: [number, number],
  format: (value: number) => string,
  label: string,
  tickFormat: (value: number) => string = format,
): string {
  const W = 520;
  const H = 170;
  const left = 64;
  const right = 56;
  const top = 12;
  const bottom = 22;
  const x = (i: number) =>
    points.length === 1
      ? left + (W - left - right) / 2
      : left + (i * (W - left - right)) / (points.length - 1);
  const y = (value: number) => top + (1 - (value - min) / (max - min)) * (H - top - bottom);
  const grid = [0, 0.5, 1]
    .map(
      (f) =>
        `<line class="grid" x1="${left}" x2="${W - right}" y1="${y(min + (max - min) * f)}" y2="${y(min + (max - min) * f)}"/>` +
        `<text class="tick" x="${left - 8}" y="${y(min + (max - min) * f) + 4}" text-anchor="end">${esc(tickFormat(min + (max - min) * f))}</text>`,
    )
    .join('');
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(' ');
  const dots = points
    .map(
      (p, i) =>
        `<circle class="dot" cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="4"/>` +
        `<circle class="hit" cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="12" tabindex="0" data-tip="${esc(p.tip)}"/>`,
    )
    .join('');
  const last = points[points.length - 1] as Point;
  const end = `<text class="end" x="${x(points.length - 1) + 10}" y="${y(last.value) + 4}">${esc(format(last.value))}</text>`;
  return (
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${grid}` +
    (points.length > 1 ? `<path class="line" d="${path}"/>` : '') +
    `${dots}${end}</svg>`
  );
}

const tile = (label: string, value: string, html = ''): string =>
  `<div class="tile"><div class="tile-label">${esc(label)}</div>` +
  (html
    ? `<div class="tile-value tile-status">${html}</div>`
    : `<div class="tile-value">${esc(value)}</div>`) +
  `</div>`;

// Status is never colour alone: each state carries an icon and a word.
const STATUS: Record<string, [icon: string, word: string, cls: string]> = {
  passed: ['✓', 'Passed', 'good'],
  flaky: ['↻', 'Flaky', 'warning'],
  failed: ['✕', 'Failed', 'critical'],
  skipped: ['–', 'Skipped', 'muted'],
};
const status = (key: string): string => {
  const [icon, word, cls] = STATUS[key] ?? ['?', key, 'muted'];
  return `<span class="status ${cls}"><span class="icon" aria-hidden="true">${icon}</span>${esc(word)}</span>`;
};

const table = (head: string[], rows: string[][], empty: string): string =>
  rows.length === 0
    ? `<p class="empty">${esc(empty)}</p>`
    : `<div class="scroll"><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>` +
      rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('') +
      `</tbody></table></div>`;

function suiteSection(suite: string, runs: StoredRun[]): string {
  const summaries = runs.map(summarize);
  const latest = summaries[summaries.length - 1] as RunSummary;
  const verdict = latest.failed > 0 ? 'failed' : latest.flaky > 0 ? 'flaky' : 'passed';
  const tip = (s: RunSummary, value: string) =>
    `${when(s.startedAt)} · ${value} · ${s.passed} passed, ${s.failed} failed, ${s.flaky} flaky`;
  const longest = Math.max(...summaries.map((s) => s.durationMs), 1000);
  // Round in the unit the axis is read in (seconds or minutes), so the ticks are whole numbers there.
  const unit = longest * 1.1 >= 60_000 ? 60_000 : 1000;
  const durationMax = niceCeil((longest * 1.1) / unit) * unit;
  // Pass rates live near 100%, so a 0-100 axis flattens the dips that matter. Zoom to the data,
  // in steps of 5, and always leave at least ten points of room. It is a line, so no zero baseline is needed.
  const lowest = Math.min(...summaries.map((s) => s.passRate));
  const passFloor = Math.max(0, Math.min(90, Math.floor(lowest / 5) * 5 - 5));
  const charts =
    `<figure><figcaption>Pass rate per run</figcaption>${lineChart(
      summaries.map((s) => ({ value: s.passRate, tip: tip(s, `${s.passRate}%`) })),
      [passFloor, 100],
      (v) => `${Math.round(v * 10) / 10}%`,
      `${suite}: pass rate over the last ${summaries.length} runs`,
    )}</figure>` +
    `<figure><figcaption>Run duration</figcaption>${lineChart(
      summaries.map((s) => ({ value: s.durationMs, tip: tip(s, seconds(s.durationMs)) })),
      [0, durationMax],
      seconds,
      `${suite}: run duration over the last ${summaries.length} runs`,
      // Ticks in the axis unit only, without needless decimals: 0, 5, 10 min.
      (v) => `${Math.round((v / unit) * 10) / 10} ${unit === 60_000 ? 'min' : 's'}`,
    )}</figure>`;
  return (
    `<section><h2>${esc(suite)} suite <small>latest run ${esc(when(latest.startedAt))} UTC</small></h2>` +
    `<div class="tiles">${tile('Result', '', status(verdict))}${tile('Pass rate', `${latest.passRate}%`)}` +
    `${tile('Passed', String(latest.passed))}${tile('Failed', String(latest.failed))}` +
    `${tile('Flaky', String(latest.flaky))}${tile('Skipped', String(latest.skipped))}` +
    `${tile('Duration', seconds(latest.durationMs))}</div>` +
    `<div class="charts">${charts}</div>` +
    (summaries.length < 2 ? `<p class="empty">Trend lines appear from the second run.</p>` : '') +
    `</section>`
  );
}

export interface DashboardOptions {
  title?: string;
  generatedAt?: Date;
}

/**
 * Renders the whole run history as one self-contained HTML page: no server, no CDN, no scripts
 * beyond a few lines for tooltips. It can be opened from disk or uploaded as a CI artifact.
 */
export function renderDashboard(history: StoredRun[], options: DashboardOptions = {}): string {
  const title = options.title ?? 'AI-QA-Platform test history';
  const runs = [...history].sort((a, b) => a.run.startedAt.localeCompare(b.run.startedAt));
  const suites = [...new Set(runs.map((r) => r.run.suite))].sort();
  const latestBySuite = suites.map((suite) => runs.filter((r) => r.run.suite === suite).at(-1) as StoredRun);
  const latestOutcomes: (TestOutcome & { suite: string })[] = latestBySuite.flatMap((stored) =>
    outcomesOf(stored.results).map((o) => ({ ...o, suite: stored.run.suite })),
  );
  const test = (o: { title: string; file: string }) =>
    `<strong>${esc(o.title)}</strong><br><span class="file">${esc(o.file)}</span>`;

  const flaky = table(
    ['Test', 'Project', 'Runs', 'Failed runs', 'Passed on retry', 'Flips', 'Score', 'Last result'],
    detectFlaky(runs).map((f) => [
      test(f),
      esc(f.project),
      String(f.runs),
      String(f.failures),
      String(f.retriedPasses),
      String(f.flips),
      f.score.toFixed(2),
      status(f.lastOutcome),
    ]),
    'No flaky tests in the recorded runs.',
  );
  const failures = table(
    ['Test', 'Suite', 'Project', 'Likely cause', 'Error'],
    latestOutcomes
      .filter((o) => o.outcome === 'failed')
      .map((o) => [
        test(o),
        esc(o.suite),
        esc(o.project),
        esc(o.failureCategory ?? 'unknown'),
        `<code>${esc(firstLine(o.errorMessage))}</code>`,
      ]),
    'No failures in the latest runs.',
  );
  const slow = table(
    ['Test', 'Suite', 'Project', 'Time', 'Attempts'],
    slowest(latestOutcomes).map((o) => [
      test(o),
      esc((o as TestOutcome & { suite: string }).suite),
      esc(o.project),
      seconds(o.durationMs),
      String(o.attempts),
    ]),
    'No tests recorded.',
  );
  const log = table(
    [
      'Started (UTC)',
      'Suite',
      'Where',
      'Commit',
      'Tests',
      'Passed',
      'Failed',
      'Flaky',
      'Skipped',
      'Pass rate',
      'Duration',
    ],
    [...runs]
      .reverse()
      .slice(0, 30)
      .map((stored) => {
        const s = summarize(stored);
        const commit = [stored.run.branch, stored.run.gitSha?.slice(0, 7)].filter(Boolean).join(' @ ');
        return [
          esc(when(s.startedAt)),
          esc(s.suite),
          esc(stored.run.environment),
          esc(commit || '–'),
          String(s.total),
          String(s.passed),
          String(s.failed),
          String(s.flaky),
          String(s.skipped),
          `${s.passRate}%`,
          seconds(s.durationMs),
        ];
      }),
    'No runs recorded yet.',
  );

  const body =
    runs.length === 0
      ? `<p class="empty">No runs recorded yet. Run a suite and reload this page.</p>`
      : suites
          .map((suite) =>
            suiteSection(
              suite,
              runs.filter((r) => r.run.suite === suite),
            ),
          )
          .join('') +
        `<section><h2>Flaky tests <small>passed only on retry, or flipped between runs at least twice</small></h2>${flaky}</section>` +
        `<section><h2>Failures in the latest runs</h2>${failures}</section>` +
        `<section><h2>Slowest tests in the latest runs</h2>${slow}</section>` +
        `<section><h2>Run log</h2>${log}</section>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
:root { color-scheme: light; --surface: #fcfcfb; --panel: #ffffff; --border: #e4e3df; --grid: #e9e8e4;
  --text: #0b0b0b; --text-2: #52514e; --series: #2a78d6; --good: #0ca30c; --warning: #fab219; --critical: #d03b3b; }
@media (prefers-color-scheme: dark) { :root { color-scheme: dark; --surface: #1a1a19; --panel: #222221; --border: #383835;
  --grid: #30302e; --text: #f0efec; --text-2: #c3c2b7; --series: #3987e5; } }
* { box-sizing: border-box; }
body { margin: 0; padding: 24px; background: var(--surface); color: var(--text); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1120px; margin: 0 auto; }
h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 16px; margin: 0 0 12px; }
small, .sub, .file, .tile-label, figcaption, .empty { color: var(--text-2); font-weight: 400; }
small { font-size: 12px; margin-left: 8px; } .file { font-size: 12px; }
section { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-top: 16px; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; }
.tile { border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; }
.tile-label { font-size: 12px; } .tile-value { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
.tile-status { font-size: 17px; line-height: 33px; }
.charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-top: 16px; }
figure { margin: 0; } figcaption { font-size: 12px; margin-bottom: 4px; } svg { width: 100%; height: auto; display: block; }
.grid { stroke: var(--grid); stroke-width: 1; } .tick, .end { font-size: 11px; fill: var(--text-2); } .end { fill: var(--text); font-weight: 600; }
.line { fill: none; stroke: var(--series); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.dot { fill: var(--series); stroke: var(--panel); stroke-width: 2; } .hit { fill: transparent; cursor: default; outline: none; }
.hit:focus-visible { stroke: var(--text); stroke-width: 1; }
.scroll { overflow-x: auto; } table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { font-size: 12px; color: var(--text-2); font-weight: 600; white-space: nowrap; }
code { font: 12px ui-monospace, Consolas, monospace; word-break: break-word; }
.status { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.icon { display: inline-grid; place-items: center; width: 18px; height: 18px; line-height: 1; flex: none; border-radius: 50%; font-size: 11px; font-weight: 700; color: #fff; background: var(--text-2); }
.good .icon { background: var(--good); } .warning .icon { background: var(--warning); color: #0b0b0b; } .critical .icon { background: var(--critical); }
#tip { position: fixed; pointer-events: none; background: var(--text); color: var(--surface); padding: 6px 8px; border-radius: 4px; font-size: 12px; display: none; max-width: 320px; z-index: 1; }
</style></head>
<body><main>
<h1>${esc(title)}</h1>
<div class="sub">${runs.length} run${runs.length === 1 ? '' : 's'} recorded · generated ${esc(when((options.generatedAt ?? new Date()).toISOString()))} UTC · hover or tab to a point for its run</div>
${body}
</main><div id="tip" role="status"></div>
<script>
const tip = document.getElementById('tip');
const show = (el) => { const r = el.getBoundingClientRect(); tip.textContent = el.dataset.tip; tip.style.display = 'block';
  tip.style.left = Math.min(r.left + 14, innerWidth - tip.offsetWidth - 8) + 'px'; tip.style.top = Math.max(8, r.top - tip.offsetHeight - 6) + 'px'; };
const hide = () => { tip.style.display = 'none'; };
for (const el of document.querySelectorAll('[data-tip]')) { el.addEventListener('mouseenter', () => show(el)); el.addEventListener('focus', () => show(el));
  el.addEventListener('mouseleave', hide); el.addEventListener('blur', hide); }
</script></body></html>`;
}
