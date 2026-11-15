import type { Locator } from '@playwright/test';

/** One product tile. Takes its root locator, so every inner locator is scoped to this card. */
export class ProductCard {
  readonly name: Locator;
  readonly price: Locator;
  readonly addToCart: Locator;
  readonly remove: Locator;

  constructor(readonly root: Locator) {
    this.name = root.getByTestId('inventory-item-name');
    this.price = root.getByTestId('inventory-item-price');
    this.addToCart = root.getByRole('button', { name: 'Add to cart' });
    this.remove = root.getByRole('button', { name: 'Remove' });
  }
}
