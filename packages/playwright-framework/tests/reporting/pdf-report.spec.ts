import { renderDashboard, renderPdfReport, type ResultRecord, type StoredRun } from '@aiqa/reporting-engine';
import { expect, test } from '@playwright/test';

/**
 * The PDF report (`pnpm aiqa report pdf`): the run-history dashboard printed by Chromium. Built from
 * made-up runs, so no recorded history or third-party site is involved.
 */
const runs: StoredRun[] = Array.from({ length: 12 }, (_, i) => {
  const startedAt = new Date(Date.UTC(2026, 10, 1, i)).toISOString();
  const id = `run-${i}`;
  const result = (testId: string, status: ResultRecord['status'], retry = 0): ResultRecord => ({
    runId: id,
    testId,
    retry,
    title: `a test with a fairly long title so the tables have to wrap ${testId}`,
    file: `tests/${testId}.spec.ts`,
    project: 'chromium',
    status,
    durationMs: 1200 + retry * 300,
    errorMessage: status === 'failed' ? `Error: ${testId} broke` : undefined,
  });
  return {
    run: { id, suite: i % 2 ? 'ui' : 'api', startedAt, finishedAt: startedAt, environment: 'local' },
    results: [
      result('a', 'passed'),
      ...(i % 3 ? [result('b', 'passed')] : [result('b', 'failed'), result('b', 'passed', 1)]),
    ],
  };
});

test.describe('PDF report', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'only Chromium prints PDFs');

  test('comes out as a real PDF', async ({ browser }) => {
    const pdf = await renderPdfReport(browser, runs, { suite: 'ui' });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const pages = pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pages.length).toBeGreaterThanOrEqual(1);
    expect(pdf.length).toBeGreaterThan(10_000);
  });

  test('nothing in the printed page is wider than the paper', async ({ page }) => {
    // A4 at the report's 12 mm side margins leaves about 700 CSS pixels.
    await page.setViewportSize({ width: 680, height: 1000 });
    await page.setContent(renderDashboard(runs, { print: true }));
    await page.emulateMedia({ media: 'print' });
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(680);
    await expect(page.locator('script')).toHaveCount(0);
    await expect(page.locator('#tip')).toHaveCount(0);
  });
});
