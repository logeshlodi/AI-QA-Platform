import type { Locator, Page } from '@playwright/test';
import { HeaderComponent } from '../../components/header.component';
import { ProductCard } from '../../components/product-card.component';
import { BasePage } from '../base.page';

export type SortOption = 'az' | 'za' | 'lohi' | 'hilo';

export class InventoryPage extends BasePage {
  protected readonly path = '/inventory.html';
  readonly header: HeaderComponent;
  readonly title: Locator;
  readonly cards: Locator;
  readonly sort: Locator;

  constructor(page: Page) {
    super(page);
    this.header = new HeaderComponent(page);
    this.title = page.getByTestId('title').describe('Page title');
    this.cards = page.getByTestId('inventory-item').describe('Product cards');
    this.sort = page.getByTestId('product-sort-container').describe('Sort dropdown');
  }

  /** Find a card by its product name, then work inside it. */
  card(productName: string): ProductCard {
    return new ProductCard(this.cards.filter({ hasText: productName }));
  }

  async addToCart(productName: string): Promise<void> {
    await this.card(productName).addToCart.click();
  }

  async sortBy(option: SortOption): Promise<void> {
    await this.sort.selectOption(option);
  }

  async prices(): Promise<number[]> {
    const texts = await this.page.getByTestId('inventory-item-price').allTextContents();
    return texts.map((t) => Number(t.replace('$', '')));
  }
}
