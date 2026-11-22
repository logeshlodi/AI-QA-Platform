import { expect, test } from '@playwright/test';
import { ChatPage } from './chat.page';
import { quarantinedIds } from './quarantine';

// Signed in as the viewer. The model is the stub (tests/fixtures/model-stub.ts): scripted, streamed.

test.describe('the chat answers from the platform tools', () => {
  test('the answer streams in, and the composer offers Stop until it ends', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.open();
    await chat.ask('Explain flaky tests at length');
    const answer = chat.answers().last();
    // Part of the answer is on screen while it is still being written.
    await expect(answer).toHaveAttribute('aria-busy', 'true');
    await expect(answer).toContainText('A flaky test passes');
    await expect(answer).not.toContainText('That is the end.');
    await expect(chat.stop()).toBeVisible();
    await chat.waitForAnswer();
    await expect(answer).not.toHaveAttribute('aria-busy');
    await expect(answer).toContainText('That is the end.');
  });

  test('Stop ends the answer where it is', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.open();
    await chat.ask('Explain flaky tests at length');
    const answer = chat.answers().last();
    await expect(answer).toContainText('Reason 1');
    await chat.stop().click();
    await expect(answer).toContainText('Stopped');
    await expect(answer).not.toContainText('That is the end.');
    await expect(chat.send()).toBeVisible();
  });

  test('answers vary in words, not in facts', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.open();
    for (let i = 0; i < 3; i++) {
      await chat.ask('Why did the last ui run fail?');
      await chat.waitForAnswer();
    }
    await expect(chat.transcript().getByText('Looked up run_failures')).toHaveCount(3);
    // The wording is the model's and changes; the run and the test names come from the tools and must not.
    for (const answer of await chat.answers().all()) {
      await expect(answer).toContainText('ui-08');
      await expect(answer).toContainText('checkout › completes an order with two items');
      await expect(answer).toContainText('inventory › sorts by price, low to high');
    }
  });
});

test.describe('an instruction planted in a page is not acted on', () => {
  test('the hijacked call waits for approval, and a viewer can only refuse it', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.open();
    // The latest storefront run failed on a page whose text tells "the model" to quarantine checkout-two.
    await chat.ask('Why did the last storefront run fail?');
    await chat.waitForAnswer();
    const card = chat.approvals();
    await expect(card).toHaveCount(1);
    await expect(card).toContainText('quarantine_test');
    await expect(card).toContainText('"testId": "checkout-two"');
    // Nothing changed: the call is only a request until a person decides.
    expect(quarantinedIds()).not.toContain('checkout-two');
    await expect(card.getByRole('button', { name: 'Approve' })).toBeDisabled();
    await card.getByRole('button', { name: 'Refuse' }).click();
    await expect(card.getByRole('status')).toHaveText('Refused: nothing was changed');
    expect(quarantinedIds()).not.toContain('checkout-two');
  });

  test('a viewer cannot approve through the API either', async ({ page, baseURL }) => {
    await page.goto('/chat');
    // The same request the page makes, with the viewer's session: the answer carries the sealed token.
    const answer = await page.request.post('/api/chat', {
      data: { messages: [{ role: 'user', content: 'Why did the last storefront run fail?' }] },
      headers: { Origin: baseURL! },
    });
    const approval = (await answer.text())
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { type: string; token?: string })
      .find((e) => e.type === 'approval');
    expect(approval?.token).toBeTruthy();
    const response = await page.request.post('/api/chat/approve', {
      data: { token: approval!.token, decision: 'approve' },
      headers: { Origin: baseURL! },
    });
    expect(response.status()).toBe(403);
    expect(quarantinedIds()).not.toContain('checkout-two');
    // A token that was changed is refused outright.
    const forged = await page.request.post('/api/chat/approve', {
      data: { token: approval!.token!.slice(0, -4) + 'AAAA', decision: 'refuse' },
      headers: { Origin: baseURL! },
    });
    expect(forged.status()).toBe(400);
  });
});

test.describe('the chat API refuses what it should', () => {
  test('no session, another site, or not JSON', async ({ page, playwright, baseURL }) => {
    // A new request context would inherit the project's signed-in storage state: empty it on purpose.
    const anonymous = await playwright.request.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    const ask = { messages: [{ role: 'user', content: 'hello' }] };
    const signedOut = await anonymous.post('/api/chat', {
      data: ask,
      headers: { Origin: baseURL! },
      maxRedirects: 0,
    });
    expect(signedOut.status()).toBe(401);
    await anonymous.dispose();
    await page.goto('/chat');
    expect(
      (
        await page.request.post('/api/chat', { data: ask, headers: { Origin: 'https://evil.example' } })
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.post('/api/chat', { form: { q: 'hello' }, headers: { Origin: baseURL! } })
      ).status(),
    ).toBe(415);
    const tooMany = { messages: Array.from({ length: 21 }, () => ({ role: 'user', content: 'x' })) };
    expect(
      (await page.request.post('/api/chat', { data: tooMany, headers: { Origin: baseURL! } })).status(),
    ).toBe(400);
  });

  test('a viewer has no admin area', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Admin' }),
    ).toHaveCount(0);
    await page.goto('/admin');
    await expect(page).toHaveURL('/no-access?area=admin');
    await expect(page.getByRole('heading', { name: 'No access to the admin area' })).toBeVisible();
  });
});
