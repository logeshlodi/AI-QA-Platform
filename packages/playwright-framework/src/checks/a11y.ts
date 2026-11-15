import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

export interface A11yViolation {
  id: string;
  impact: string;
  help: string;
  nodes: number;
}

/** Run axe-core against the page. Returns a compact list that is easy to attach to a report. */
export async function scanAccessibility(
  page: Page,
  tags: string[] = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
): Promise<A11yViolation[]> {
  const results = await new AxeBuilder({ page }).withTags(tags).analyze();
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? 'unknown',
    help: v.help,
    nodes: v.nodes.length,
  }));
}
