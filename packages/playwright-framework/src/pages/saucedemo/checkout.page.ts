import type { Locator, Page } from '@playwright/test';
import type { Customer } from '../../data/users';
import { BasePage } from '../base.page';

export class CheckoutPage extends BasePage {
  protected readonly path = '/checkout-step-one.html';
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly postalCode: Locator;
  readonly continueButton: Locator;
  readonly finishButton: Locator;
  readonly subtotal: Locator;
  readonly completeHeader: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    super(page);
    this.firstName = page.getByPlaceholder('First Name').describe('First name');
    this.lastName = page.getByPlaceholder('Last Name').describe('Last name');
    this.postalCode = page.getByPlaceholder('Zip/Postal Code').describe('Postal code');
    this.continueButton = page.getByRole('button', { name: 'Continue' }).describe('Continue button');
    this.finishButton = page.getByRole('button', { name: 'Finish' }).describe('Finish button');
    this.subtotal = page.getByTestId('subtotal-label').describe('Item subtotal');
    this.completeHeader = page.getByTestId('complete-header').describe('Order complete header');
    this.error = page.getByTestId('error').describe('Checkout error banner');
  }

  async fillCustomer(customer: Customer): Promise<void> {
    await this.firstName.fill(customer.firstName);
    await this.lastName.fill(customer.lastName);
    await this.postalCode.fill(customer.postalCode);
    await this.continueButton.click();
  }
}
