import type { Page } from '@playwright/test';

/**
 * Base for every page object.
 * Rule: a page object exposes locators and user actions. It never asserts a
 * business outcome; assertions belong in specs so a failure reads as a test failure.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /** Path relative to the project's baseURL. */
  protected abstract readonly path: string;

  async goto(): Promise<void> {
    await this.page.goto(this.path);
  }
}
