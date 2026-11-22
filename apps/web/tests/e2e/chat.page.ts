import { expect, type Page } from '@playwright/test';

/** The chat page: ask, watch the answer stream, decide on changes. */
export class ChatPage {
  constructor(private readonly page: Page) {}

  readonly question = () =>
    this.page.getByRole('textbox', { name: 'Ask about runs, failures, flaky tests or heals' });
  readonly transcript = () => this.page.getByRole('list', { name: 'Conversation' });
  readonly answers = () => this.transcript().locator('.aiqa-chat__msg--assistant');
  readonly approvals = () =>
    this.transcript().getByRole('listitem', { name: /^Change waiting for approval/ });
  readonly send = () => this.page.getByRole('button', { name: 'Send' });
  readonly stop = () => this.page.getByRole('button', { name: 'Stop' });

  async open() {
    await this.page.goto('/chat');
    await expect(this.page.getByRole('heading', { name: 'Chat', level: 1 })).toBeVisible();
  }

  async ask(question: string) {
    await this.question().fill(question);
    await this.question().press('Enter');
  }

  /** Waits for the answer to finish: the composer offers Send again. */
  async waitForAnswer() {
    await expect(this.send()).toBeVisible({ timeout: 30_000 });
  }
}
