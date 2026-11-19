import { expect, test } from '../../src/fixtures';
import { SAUCE_AUTH_FILE } from '../../src/paths';
import { overBudget, recordMetrics, summarizeResources } from '../../src/perf';

// A performance budget: limits on what a page may download. Unlike timings, sizes and request
// counts do not depend on the network, so the budget can sit close to today's numbers and catch a
// regression the day someone adds a heavy library or an unoptimised image.
//
// Measured on 19 Nov 2026 (cold cache, identical in three runs) and set about 25% above:
// 10 requests, 730,187 bytes decoded, of which 550,465 scripts and 145,704 images.
const INVENTORY_BUDGET = {
  requests: 13,
  decoded_bytes: 915_000,
  script_decoded_bytes: 690_000,
  img_decoded_bytes: 185_000,
};

test.describe('page weight', { tag: '@perf' }, () => {
  test.use({ targetName: 'saucedemo', storageState: SAUCE_AUTH_FILE });

  test('the inventory page stays within its download budget', async ({ page }, testInfo) => {
    await page.goto('/inventory.html');
    // Product images keep arriving after the load event: count only once every image has loaded.
    await expect
      .poll(() =>
        page.evaluate(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0)),
      )
      .toBe(true);
    const summary = await summarizeResources(page);
    const metrics = {
      requests: summary.requests,
      transfer_bytes: summary.transferBytes,
      decoded_bytes: summary.decodedBytes,
      script_decoded_bytes: summary.byType.script?.decodedBytes ?? 0,
      img_decoded_bytes: summary.byType.img?.decodedBytes ?? 0,
      third_party_requests: summary.thirdPartyRequests,
    };
    await recordMetrics(testInfo, metrics, 'page-weight');
    await testInfo.attach('resources.json', {
      body: JSON.stringify(summary, null, 2),
      contentType: 'application/json',
    });
    expect(overBudget(metrics, INVENTORY_BUDGET)).toEqual([]);
  });
});
