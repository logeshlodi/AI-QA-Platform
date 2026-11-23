import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { XSS_TITLE } from '../fixtures/seed';
import { FIXTURE_DIR } from './users';

// Signed in as the platform admin (the security project, after the admin specs, which change the same
// settings): the person an attacker would most like to borrow. Two attacks, with the defences named.

const SETTINGS = path.join(FIXTURE_DIR, 'web-settings.json');
const settingsNow = () => (fs.existsSync(SETTINGS) ? fs.readFileSync(SETTINGS, 'utf8') : '(defaults)');

test.describe('cross-site request forgery on the admin settings', () => {
  /** The settings form's hidden fields: the Server Function's id is public, in the page's own HTML. */
  async function settingsFormFields(page: import('@playwright/test').Page) {
    await page.goto('/admin');
    const form = page.getByRole('region', { name: 'Chat budget' }).locator('form');
    const hidden = await form
      .locator('input[type="hidden"]')
      .evaluateAll((inputs) =>
        inputs.map((i) => [(i as HTMLInputElement).name, (i as HTMLInputElement).value]),
      );
    const steps = await form.getByLabel('Model steps per answer (2 to 8)').inputValue();
    const timeout = await form.getByLabel('Time limit per answer, seconds (30 to 1800)').inputValue();
    const writes = await form.getByRole('checkbox').isChecked();
    return { hidden, steps, timeout, writes };
  }

  test('a page on another site that posts the form while the admin is signed in changes nothing', async ({
    page,
    context,
    baseURL,
  }) => {
    const before = settingsNow();
    const { hidden } = await settingsFormFields(page);
    expect(hidden.length).toBeGreaterThan(0);

    // The attacker's page copies the form, sets the budget to the maximum, and submits on load.
    const fields = [...hidden, ['chatMaxSteps', '8'], ['chatTimeoutSec', '600']]
      .map(([name, value]) => `<input type="hidden" name="${name}" value="${value}">`)
      .join('');
    await context.route('https://evil.example/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<form id="f" method="post" enctype="multipart/form-data" action="${baseURL}/admin">${fields}</form>
               <script>document.getElementById('f').submit()</script>`,
      }),
    );
    const posted = page.waitForRequest(
      (r) => r.url().startsWith(`${baseURL}/admin`) && r.method() === 'POST',
    );
    await page.goto('https://evil.example/win-a-prize');
    const request = await posted;

    // Defence 1: the session cookie is SameSite=Lax, so a cross-site POST goes without it.
    expect((await request.allHeaders()).cookie ?? '').not.toContain('aiqa_session');
    await expect(page).not.toHaveURL(/saved=settings/);
    expect(settingsNow()).toBe(before);
  });

  test('the same request with the admin’s cookie is refused when it comes from another origin', async ({
    page,
    baseURL,
  }) => {
    const before = settingsNow();
    const { hidden, steps, timeout, writes } = await settingsFormFields(page);
    const multipart = (values: [string, string][]) => Object.fromEntries(values);
    const body = multipart([
      ...(hidden as [string, string][]),
      ['chatMaxSteps', '8'],
      ['chatTimeoutSec', '600'],
    ]);

    // Defence 2: Server Functions only run for a same-origin request, cookie or not.
    const forged = await page.request.post('/admin', {
      multipart: body,
      headers: { Origin: 'https://evil.example' },
      maxRedirects: 0,
    });
    expect(forged.headers().location ?? '').not.toContain('saved=settings');
    expect(settingsNow()).toBe(before);

    // Control: the identical request from the app's own origin is accepted, so the refusal above is
    // the origin check and not a malformed request. It saves the values the form already had.
    const current: [string, string][] = [
      ['chatMaxSteps', steps],
      ['chatTimeoutSec', timeout],
    ];
    if (writes) current.push(['chatWritesEnabled', 'on']);
    const genuine = await page.request.post('/admin', {
      multipart: multipart([...(hidden as [string, string][]), ...current]),
      headers: { Origin: baseURL! },
      maxRedirects: 0,
    });
    expect(genuine.status()).toBe(303);
    expect(genuine.headers().location).toContain('saved=settings');
  });
});

test.describe('stored cross-site scripting', () => {
  test('markup in a test title from the run history is shown as text and never runs', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(d.message());
      void d.dismiss();
    });
    await page.goto('/runs/storefront-01');

    // The title appears exactly as stored: escaped text, not elements.
    await expect(page.getByText(XSS_TITLE, { exact: true })).toBeVisible();
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    expect(dialogs).toEqual([]);
  });
});
