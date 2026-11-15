import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../base.page';

export class CartPage extends BasePage {
  protected readonly path = '/cart.html';
  readonly items: Locator;
  readonly itemNames: Locator;
  readonly checkoutButton: Locator;

  constructor(page: Page) {
    super(page);
    this.items = page.getByTestId('inventory-item').describe('Cart rows');
    this.itemNames = page.getByTestId('inventory-item-name').describe('Cart item names');
    this.checkoutButton = page.getByRole('button', { name: 'Checkout' }).describe('Checkout button');
  }
}
