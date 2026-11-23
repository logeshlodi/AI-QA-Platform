import { renderDashboard } from './dashboard';
import type { StoredRun } from './types';

export interface PdfReportOptions {
  /** Only this suite's runs (ui, api, data, load, agents...). */
  suite?: string;
  title?: string;
  generatedAt?: Date;
}

/** The runs a report covers, and its title. Pure, so the choice is unit-tested without a browser. */
export function reportInput(runs: StoredRun[], options: PdfReportOptions = {}) {
  const chosen = options.suite ? runs.filter((r) => r.run.suite === options.suite) : runs;
  const title =
    options.title ?? `AI-QA-Platform test report${options.suite ? `: ${options.suite} suite` : ''}`;
  return { runs: chosen, title };
}

/**
 * The little of a Playwright browser this needs. Engines do not import the test runner (lint rule), and
 * any Playwright Browser fits this shape.
 */
export interface PdfBrowser {
  newPage(): Promise<{
    setContent(html: string, options?: { waitUntil?: 'load' }): Promise<unknown>;
    emulateMedia(options: { media: 'print' }): Promise<unknown>;
    pdf(options: Record<string, unknown>): Promise<Buffer>;
    close(): Promise<unknown>;
  }>;
}

/**
 * The run-history dashboard as a PDF: the same page, rendered in its print mode (light, no tooltips,
 * sections kept whole) and printed by Chromium to A4, with the title and page numbers in the footer.
 */
export async function renderPdfReport(
  browser: PdfBrowser,
  runs: StoredRun[],
  options: PdfReportOptions = {},
): Promise<Buffer> {
  const input = reportInput(runs, options);
  const html = renderDashboard(input.runs, {
    title: input.title,
    generatedAt: options.generatedAt,
    print: true,
  });
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="font: 9px system-ui, sans-serif; color: #52514e; width: 100%; padding: 0 12mm; display: flex; justify-content: space-between;"><span>${input.title.replace(/[<>&]/g, '')}</span><span>page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    });
  } finally {
    await page.close();
  }
}
