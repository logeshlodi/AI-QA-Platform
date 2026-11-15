import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';
import { auditWithLighthouse } from '../../src/checks/lighthouse';
import { paths } from '../../src/paths';

// Lighthouse scores move with machine load, so these are floors that catch real regressions, not targets.
// Raise them as you fix things. Override per run with LH_MIN_<CATEGORY>, e.g. LH_MIN_PERFORMANCE=70.
const floor = (name: string, fallback: number) => Number(process.env[`LH_MIN_${name}`] ?? fallback);

test.describe('Lighthouse audits', { tag: '@audit' }, () => {
  test('SauceDemo login page meets the score floors', async ({}, testInfo) => {
    const scores = await auditWithLighthouse({
      url: targetUrl('saucedemo'),
      channel: testInfo.project.use.channel,
      reportDir: paths.lighthouseReports,
      reportName: 'saucedemo-login',
    });
    testInfo.annotations.push({ type: 'lighthouse', description: JSON.stringify(scores) });
    await testInfo.attach('lighthouse-scores', {
      body: JSON.stringify(scores, null, 2),
      contentType: 'application/json',
    });

    expect.soft(scores.performance, 'performance').toBeGreaterThanOrEqual(floor('PERFORMANCE', 40));
    expect.soft(scores.accessibility, 'accessibility').toBeGreaterThanOrEqual(floor('ACCESSIBILITY', 70));
    expect
      .soft(scores['best-practices'], 'best practices')
      .toBeGreaterThanOrEqual(floor('BEST_PRACTICES', 70));
    expect.soft(scores.seo, 'seo').toBeGreaterThanOrEqual(floor('SEO', 50));
  });
});
