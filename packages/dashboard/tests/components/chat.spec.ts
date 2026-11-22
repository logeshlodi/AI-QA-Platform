import { expect, test } from '@playwright/test';
import type { Composer } from '../../src/components/ChatTranscript.story';

test.describe('ChatTranscript', () => {
  test('shows the question, the tool the answer used, and the answer', async ({ mount }) => {
    const component = await mount('ChatTranscript/Answered');
    const items = component.getByRole('list', { name: 'Conversation' }).getByRole('listitem');
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toHaveText('You: Why did the last ui run fail?');
    await expect(items.nth(1)).toContainText('Looked up run_failures');
    await items.nth(1).getByText('Looked up').click();
    await expect(items.nth(1).locator('pre')).toContainText('"suite": "ui"');
    await expect(items.nth(2)).toContainText('checkout › completes an order with two items');
  });

  test('a streaming answer is marked busy; a stopped one says so', async ({ mount }) => {
    let component = await mount('ChatTranscript/Streaming');
    await expect(component.locator('[aria-busy="true"]')).toHaveCount(1);
    component = await mount('ChatTranscript/Stopped');
    await expect(component.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(component.getByText('Stopped')).toBeVisible();
  });

  test('a viewer can refuse a change but not approve it', async ({ mount }) => {
    const component = await mount('ChatTranscript/WaitingForAViewer');
    const card = component.getByRole('listitem', { name: 'Change waiting for approval: quarantine_test' });
    await expect(card).toContainText('"testId": "checkout-two"');
    await expect(card.getByRole('button', { name: 'Approve' })).toBeDisabled();
    await expect(card.getByRole('button', { name: 'Refuse' })).toBeEnabled();
    await expect(card).toContainText('Only a platform admin can approve a change.');
  });

  test('an admin decides each change on its own', async ({ mount }) => {
    const component = await mount('ChatTranscript/AdminDecides');
    const cards = component.getByRole('listitem');
    await cards.nth(1).getByRole('button', { name: 'Refuse' }).click();
    await cards.nth(0).getByRole('button', { name: 'Approve' }).click();
    await expect(component.getByTestId('decisions')).toHaveValue('p2:denied,p1:approved');
    await expect(cards.nth(0).getByRole('status')).toHaveText('Approved and done');
    await expect(cards.nth(1).getByRole('status')).toHaveText('Refused: nothing was changed');
    await expect(component.getByRole('button')).toHaveCount(0);
  });

  test('every outcome is stated in words', async ({ mount }) => {
    const component = await mount('ChatTranscript/Outcomes');
    await expect(component.getByRole('status')).toHaveText([
      'Approved and done: checkout-two is quarantined',
      'Refused: nothing was changed',
      'Approved, but it failed: the file is read-only',
    ]);
    await expect(component.getByRole('alert')).toHaveText('The model did not answer in time.');
  });
});

test.describe('ChatComposer', () => {
  test('Enter sends and clears; Shift+Enter adds a line; blank is not sent', async ({ mount, page }) => {
    const component = await mount('ChatTranscript/Composer');
    const box = component.getByRole('textbox', { name: 'Ask about runs, failures, flaky tests or heals' });
    await expect(component.getByRole('button', { name: 'Send' })).toBeDisabled();
    await box.fill('   ');
    await box.press('Enter');
    await expect(component.getByTestId('sent')).toHaveValue('[]');
    await box.fill('first line');
    await box.press('Shift+Enter');
    await page.keyboard.type('second line');
    await box.press('Enter');
    await expect(component.getByTestId('sent')).toHaveValue(JSON.stringify(['first line\nsecond line']));
    await expect(box).toHaveValue('');
  });

  test('while busy, the button stops the answer instead', async ({ mount }) => {
    const component = await mount<typeof Composer>('ChatTranscript/Composer', { busy: true });
    await expect(component.getByRole('button', { name: 'Send' })).toHaveCount(0);
    await component.getByRole('button', { name: 'Stop' }).click();
    await expect(component.getByTestId('stops')).toHaveValue('1');
    await component.update({ busy: false });
    await expect(component.getByRole('button', { name: 'Send' })).toBeVisible();
  });
});
