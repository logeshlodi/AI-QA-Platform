import type { Locator, Page } from '@playwright/test';

/** The shape of the page object heal-review.spec.ts patches and imports; used only for its type. */
export declare class PayPage {
  constructor(page: Page);
  readonly payButton: () => Locator;
}
