import { targetUrl } from '@aiqa/shared';
import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'uiPlayground' });

// A custom matcher gives a domain rule a name and a readable failure message.
const expectList = expect.extend({
  toBeSortedAscending(received: number[]) {
    const pass = received.every((value, i) => i === 0 || received[i - 1]! <= value);
    return {
      pass,
      message: () => `expected [${received.join(', ')}] ${pass ? 'not ' : ''}to be sorted ascending`,
    };
  },
});

test.describe('assertions', () => {
  test('a web-first assertion waits for slow AJAX without any sleep', async ({ page }) => {
    await page.goto(targetUrl('uiPlayground', '/ajax'));
    await page.getByRole('button', { name: 'Button Triggering AJAX Request' }).click();
    await expect(page.locator('.bg-success')).toHaveText('Data loaded with AJAX get request.', {
      timeout: 25_000,
    });
  });

  test('expect.poll retries a value until it satisfies the matcher', async ({ page }) => {
    await page.goto(targetUrl('uiPlayground', '/progressbar'));
    const bar = page.getByRole('progressbar');
    await page.getByRole('button', { name: 'Start' }).click();
    await expect
      .poll(async () => Number(await bar.getAttribute('aria-valuenow')), { timeout: 40_000 })
      .toBeGreaterThanOrEqual(50);
    await page.getByRole('button', { name: 'Stop' }).click();
    expect(Number(await bar.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(50);
  });

  test('toPass retries a whole block of steps', async ({ page }) => {
    await page.goto(targetUrl('uiPlayground', '/textinput'));
    await expect(async () => {
      await page.getByRole('textbox').fill('Renamed');
      await page.locator('#updatingButton').click();
      await expect(page.locator('#updatingButton')).toHaveText('Renamed', { timeout: 1000 });
    }).toPass({ timeout: 10_000 });
  });

  test('soft assertions report every problem instead of stopping at the first', async ({ page }) => {
    await page.goto(targetUrl('uiPlayground', '/'));
    await expect.soft(page).toHaveTitle('UI Test Automation Playground');
    await expect.soft(page.getByRole('link', { name: 'Dynamic ID' })).toBeVisible();
    await expect.soft(page.getByRole('link', { name: 'Shadow DOM' })).toBeVisible();
    expect(test.info().errors).toHaveLength(0);
  });

  test('a custom matcher made with expect.extend', () => {
    expectList([7.99, 9.99, 15.99]).toBeSortedAscending();
    expectList([9.99, 7.99]).not.toBeSortedAscending();
  });
});
