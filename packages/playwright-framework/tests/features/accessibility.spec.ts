import { scanAccessibility } from '../../src/checks/a11y';
import { expect, test } from '../../src/fixtures';

test.use({ targetName: 'saucedemo' });

test('the login page has no critical accessibility violations (axe-core, WCAG 2.1 A and AA)', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  const violations = await scanAccessibility(page);
  await testInfo.attach('axe-violations.json', {
    body: JSON.stringify(violations, null, 2),
    contentType: 'application/json',
  });
  expect(violations.filter((v) => v.impact === 'critical')).toEqual([]);
});
