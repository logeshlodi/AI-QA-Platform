import type { Browser } from 'webdriverio';

/**
 * The base of every screen object. Locator order, best first:
 *  1. accessibility ID (`~id`): Android's content-desc, iOS's accessibility identifier; the same
 *     selector on both platforms, and what a screen reader announces;
 *  2. resource ID or UiSelector text, for system views the app does not own (dialogs, pickers);
 *  3. XPath only with a comment saying why nothing else works. It is slow on Android and breaks
 *     when the layout changes.
 *
 * WebdriverIO 10's `$` is strict: a selector that matches two elements throws. Use `$$` when
 * several are expected, and narrow the selector when one is.
 *
 * Screen objects act and read; specs assert (with `expect.poll` for anything that changes).
 */
export abstract class Screen {
  /** The accessibility ID on the screen's root view, used to tell that the screen is showing. */
  protected abstract readonly marker: string;

  constructor(protected readonly driver: Browser) {}

  protected byId(id: string) {
    return this.driver.$(`~${id}`);
  }

  protected byText(text: string) {
    return this.driver.$(`android=new UiSelector().text(${JSON.stringify(text)})`);
  }

  protected byTextContaining(text: string) {
    return this.driver.$(`android=new UiSelector().textContains(${JSON.stringify(text)})`);
  }

  protected byResourceId(id: string) {
    return this.driver.$(`android=new UiSelector().resourceId(${JSON.stringify(id)})`);
  }

  async waitUntilShown(timeout = 20_000): Promise<this> {
    await this.byId(this.marker).waitForDisplayed({
      timeout,
      timeoutMsg: `${this.constructor.name} did not show`,
    });
    return this;
  }

  async isShown(): Promise<boolean> {
    return this.byId(this.marker).isDisplayed();
  }

  /** Whether some text is on screen now (no waiting; use with expect.poll). */
  async showsText(text: string): Promise<boolean> {
    return this.byText(text).isDisplayed();
  }

  /** The soft keyboard covers the lower half of the screen; buttons under it cannot be tapped. */
  async hideKeyboard(): Promise<void> {
    if (await this.driver.isKeyboardShown()) await this.driver.hideKeyboard();
  }
}
