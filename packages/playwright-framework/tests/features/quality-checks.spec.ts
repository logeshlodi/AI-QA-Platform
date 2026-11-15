import { targetUrl } from '@aiqa/shared';
import { missingSecurityHeaders } from '../../src/checks/headers';
import { expect, test } from '../../src/fixtures';

test.describe('console and network health', () => {
  test.use({ targetName: 'theInternet' });

  test('an uncaught JavaScript error is captured by the consoleErrors fixture', async ({
    page,
    consoleErrors,
  }) => {
    await page.goto(targetUrl('theInternet', '/javascript_error'));
    await expect.poll(() => consoleErrors.join('\n')).toContain('Cannot read properties of undefined');
  });

  test('broken images are found by checking their natural width', async ({ page }) => {
    await page.goto(targetUrl('theInternet', '/broken_images'), { waitUntil: 'load' });
    const broken = await page
      .locator('.example img')
      .evaluateAll((images) =>
        (images as HTMLImageElement[])
          .filter((img) => img.naturalWidth === 0)
          .map((img) => img.getAttribute('src')),
      );
    expect(broken).toEqual(['asdf.jpg', 'hjkl.jpg']);
  });

  test('link targets are checked through the API, without loading each page', async ({ request }) => {
    const statuses: Record<string, number> = {};
    for (const code of ['200', '404', '500']) {
      const response = await request.get(targetUrl('theInternet', `/status_codes/${code}`));
      statuses[code] = response.status();
    }
    expect(statuses).toEqual({ '200': 200, '404': 404, '500': 500 });
  });
});

test.describe('security headers and SEO basics', () => {
  test.use({ targetName: 'saucedemo' });

  test('security headers are reported; the gap is recorded, not hidden', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response!.headers();
    expect(headers['content-type']).toContain('text/html');
    // A demo site is not hardened, so this spec reports what is missing rather than failing on it.
    test.info().annotations.push({
      type: 'missing-security-headers',
      description: missingSecurityHeaders(headers).join(', ') || 'none',
    });
  });

  test('the page has a title, a description, a language and a viewport', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Swag Labs');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /width=device-width/);
  });
});
