import { defaultCustomer, type Customer } from '../data/users';
import type { CartPage } from '../pages/saucedemo/cart.page';
import type { CheckoutPage } from '../pages/saucedemo/checkout.page';
import type { InventoryPage } from '../pages/saucedemo/inventory.page';

/**
 * Facade over three pages. A spec says WHAT it buys; this class knows HOW.
 * When the checkout gains a step, one method changes and no spec does.
 */
export class CheckoutFlow {
  constructor(
    private readonly inventory: InventoryPage,
    private readonly cart: CartPage,
    private readonly checkout: CheckoutPage,
  ) {}

  /** From the inventory page to the order overview, stopping before "Finish". */
  async toOverview(products: string[], customer: Customer = defaultCustomer): Promise<void> {
    for (const product of products) await this.inventory.addToCart(product);
    await this.inventory.header.openCart();
    await this.cart.checkoutButton.click();
    await this.checkout.fillCustomer(customer);
  }

  async buy(products: string[], customer: Customer = defaultCustomer): Promise<void> {
    await this.toOverview(products, customer);
    await this.checkout.finishButton.click();
  }
}
