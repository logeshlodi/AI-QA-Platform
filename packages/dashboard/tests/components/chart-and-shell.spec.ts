import { expect, test } from '@playwright/test';
import type { SignedIn } from '../../src/components/AppShell.story';

test.describe('TrendChart', () => {
  test('names the chart and its latest value', async ({ mount }) => {
    const component = await mount('TrendChart/PassRate');
    await expect(component.getByRole('img', { name: /Pass rate/ })).toBeVisible();
    await expect(component.getByRole('figure')).toContainText('Latest 97.5% (22 Nov)');
  });

  test('hovering shows the nearest run in a tooltip', async ({ mount }) => {
    const component = await mount('TrendChart/PassRate');
    const plot = component.getByRole('img', { name: /Pass rate/ });
    await expect(component.getByRole('status')).toHaveCount(0);
    const box = (await plot.boundingBox())!;
    // The left edge of the plot area is the first run.
    await plot.hover({ position: { x: 8, y: box.height / 2 } });
    await expect(component.getByRole('status')).toHaveText('13 Nov97.5%');
    await plot.hover({ position: { x: box.width - 4, y: box.height / 2 } });
    await expect(component.getByRole('status')).toHaveText('22 Nov97.5%');
  });

  test('the arrow keys step through the runs', async ({ mount, page }) => {
    const component = await mount('TrendChart/PassRate');
    await component.getByRole('img', { name: /Pass rate/ }).focus();
    await expect(component.getByRole('status')).toContainText('22 Nov');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(component.getByRole('status')).toHaveText('20 Nov100%');
  });

  test('the same numbers are available as a table', async ({ mount }) => {
    const component = await mount('TrendChart/PassRate');
    const table = component.getByRole('table');
    await expect(table).toBeHidden();
    await component.getByText('Show as a table').click();
    await expect(table.getByRole('row')).toHaveCount(11);
    await expect(table.getByRole('row').nth(6)).toHaveText('18 Nov95.8%');
  });

  test('a single run and no runs both render', async ({ mount }) => {
    await expect((await mount('TrendChart/OnePoint')).getByRole('figure')).toContainText('Latest 97.5%');
    await expect((await mount('TrendChart/Empty')).getByRole('status')).toHaveText(
      'No data for pass rate yet',
    );
  });
});

test.describe('AppShell', () => {
  test('marks the current page and moves the mark when the page changes', async ({ mount }) => {
    const component = await mount<typeof SignedIn>('AppShell/SignedIn', { current: '/runs' });
    const nav = component.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'Runs', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(nav.locator('[aria-current]')).toHaveCount(1);
    // update() re-renders the same story with new props, without remounting.
    await component.update({ current: '/heals' });
    await expect(nav.getByRole('link', { name: 'Heal audit' })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: 'Runs', exact: true })).not.toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('a run detail page still marks Runs', async ({ mount }) => {
    const component = await mount<typeof SignedIn>('AppShell/SignedIn', { current: '/runs/r5' });
    await expect(component.getByRole('link', { name: 'Runs', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(component.getByRole('link', { name: 'Overview' })).not.toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('the skip link is the first stop and lands on the content', async ({ mount, page }) => {
    const component = await mount('AppShell/SignedIn');
    await page.keyboard.press('Tab');
    const skip = component.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(component.getByRole('main')).toBeFocused();
  });

  test('shows who is signed in and how to sign out', async ({ mount }) => {
    const component = await mount('AppShell/SignedIn');
    await expect(component.getByRole('banner')).toContainText('Signed in as Dashboard Viewer');
    await expect(component.getByRole('link', { name: 'Sign out' })).toHaveAttribute('href', '/auth/logout');
  });
});
