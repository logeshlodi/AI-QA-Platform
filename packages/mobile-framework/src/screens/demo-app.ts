import type { Browser } from 'webdriverio';
import { Screen } from './screen';

// Screen objects for WebdriverIO's native demo app 2.2.0 (React Native, Expo). The accessibility
// IDs come from the app's source: `testProperties(id)` in src/config/TestProperties.ts sets the
// Android content-desc, and buttons are `button-<text or testID>`.

/** Tabs in the bottom bar, by their accessibility label. Permissions and Data are in the side menu. */
export type Tab = 'Home' | 'Webview' | 'Login' | 'Forms' | 'Swipe' | 'Drag';
export type MenuItem =
  'home' | 'webview' | 'login' | 'forms' | 'swipe' | 'drag' | 'permissions' | 'data-management';

export class Navigation extends Screen {
  protected readonly marker = 'Menu';

  async open(tab: Tab): Promise<void> {
    await this.byId(tab).click();
  }

  /** The side menu lists every screen, including the two that are not in the tab bar. */
  async openFromMenu(item: MenuItem): Promise<void> {
    await this.byId('Menu').click();
    await this.byId('tab-side-menu-panel').waitForDisplayed();
    await this.byId(`side-menu-item-${item}`).click();
  }

  async isMenuOpen(): Promise<boolean> {
    return this.byId('tab-side-menu-panel').isDisplayed();
  }

  /** Android's system back button. */
  async back(): Promise<void> {
    await this.driver.back();
  }
}

export class HomeScreen extends Screen {
  protected readonly marker = 'Home-screen';
}

/** Reached from the side menu only (not pinned in the tab bar by default). */
export class PermissionsScreen extends Screen {
  protected readonly marker = 'Permissions-screen';
}

/** Reached from the side menu only: data kept in memory, AsyncStorage, SQLite and secure storage. */
export class DataScreen extends Screen {
  protected readonly marker = 'DataManagement-screen';
}

export class LoginScreen extends Screen {
  protected readonly marker = 'Login-screen';

  private get email() {
    return this.byId('input-email');
  }
  private get password() {
    return this.byId('input-password');
  }
  private get repeatPassword() {
    return this.byId('input-repeat-password');
  }

  async switchToSignUp(): Promise<void> {
    await this.byId('button-sign-up-container').click();
    await this.repeatPassword.waitForDisplayed();
  }

  async switchToLogin(): Promise<void> {
    await this.byId('button-login-container').click();
  }

  async fill(email: string, password: string, repeat?: string): Promise<void> {
    await this.email.setValue(email);
    await this.password.setValue(password);
    if (repeat !== undefined) await this.repeatPassword.setValue(repeat);
    await this.hideKeyboard();
  }

  async submitLogin(): Promise<void> {
    await this.byId('button-LOGIN').click();
  }

  async submitSignUp(): Promise<void> {
    await this.byId('button-SIGN UP').click();
  }

  async isSignUpShown(): Promise<boolean> {
    return this.repeatPassword.isDisplayed();
  }

  /** What the password field holds as the app sees it: Android reports dots for a secure field. */
  async passwordFieldIsSecure(): Promise<boolean> {
    return (await this.password.getAttribute('password')) === 'true';
  }
}

/** The app's validation messages, worded as the app words them. */
export const LOGIN_ERRORS = {
  email: 'Please enter a valid email address',
  password: 'Please enter at least 8 characters',
  repeat: 'Please enter the same password',
} as const;

export class FormsScreen extends Screen {
  protected readonly marker = 'Forms-screen';

  async type(text: string): Promise<void> {
    await this.byId('text-input').setValue(text);
    await this.hideKeyboard();
  }

  async clearInput(): Promise<void> {
    await this.byId('text-input').clearValue();
    await this.hideKeyboard();
  }

  /** The app echoes the input into a separate text view; reading it proves the input event fired. */
  async echoedText(): Promise<string> {
    return this.byId('input-text-result').getText();
  }

  async toggleSwitch(): Promise<void> {
    await this.byId('switch').click();
  }

  async isSwitchOn(): Promise<boolean> {
    return (await this.byId('switch').getAttribute('checked')) === 'true';
  }

  async switchLabel(): Promise<string> {
    return this.byId('switch-text').getText();
  }

  /** Opens the native picker and taps an option by its label. */
  async choose(option: string): Promise<void> {
    await this.byId('Dropdown').click();
    await this.byText(option).waitForDisplayed();
    await this.byText(option).click();
  }

  /** The value shown in the closed dropdown (a read-only text field inside it). */
  async chosen(): Promise<string> {
    return this.byId('Dropdown').$('android=new UiSelector().className("android.widget.EditText")').getText();
  }

  async tapActive(): Promise<void> {
    await this.scrollToButtons();
    await this.byId('button-Active').click();
  }

  async tapInactive(): Promise<void> {
    await this.scrollToButtons();
    await this.byId('button-Inactive').click();
  }

  /** The buttons can sit below the fold on a small screen; the scroll target is the form itself. */
  private async scrollToButtons(): Promise<void> {
    await this.scrollUntilShown(this.byId('button-Active'), this.byId('Forms-screen'), 5);
  }
}

export class SwipeScreen extends Screen {
  protected readonly marker = 'Swipe-screen';

  /** The carousel has a testID, which React Native turns into a resource ID on Android. */
  private get carousel() {
    return this.byResourceId('Carousel');
  }

  /**
   * Swipes the carousel with UiAutomator2's own gesture (`mobile: swipeGesture`): `left` brings the
   * next card. Checked on the emulator, where hand-built W3C touch moves did not move this carousel.
   */
  async swipeCarousel(direction: 'left' | 'right'): Promise<void> {
    await this.driver.execute('mobile: swipeGesture', {
      elementId: await this.carousel.elementId,
      direction,
      percent: 0.75,
    });
  }

  /**
   * The title of the card in the middle of the screen. The carousel keeps its neighbours in the UI
   * tree (partly visible), so "is this text displayed" cannot say which card is current: the item
   * nearest the centre is. Each item (`__CAROUSEL_ITEM_n__`) holds the `card` view, an icon glyph,
   * the title (upper-cased by the app) and a line of text, side by side rather than nested.
   */
  async currentCardTitle(): Promise<string> {
    const { width } = await this.driver.getWindowSize();
    const items = await this.driver.$$(
      'android=new UiSelector().resourceIdMatches("__CAROUSEL_ITEM_[0-9]+__")',
    );
    const rects = [];
    for (const item of items) rects.push({ ...(await item.getLocation()), ...(await item.getSize()) });
    const centre = pickNearestToCentre(rects, width);
    if (centre < 0) throw new Error('No carousel item on screen');
    const texts = await items[centre]!.$$('android=new UiSelector().className("android.widget.TextView")');
    for (const text of texts) {
      const value = await text.getText();
      if (isCardTitle(value)) return value;
    }
    throw new Error('The centre carousel item has no title');
  }

  /** Scrolls the screen down until the hidden logo shows. */
  async scrollToHiddenLogo(): Promise<void> {
    await this.scrollUntilShown(this.byId('WebdriverIO logo'), this.byId('Swipe-screen'));
  }

  async isLogoShown(): Promise<boolean> {
    return this.byId('WebdriverIO logo').isDisplayed();
  }
}

/** A card title: upper-case words, not an icon glyph (a single private-use character). */
export function isCardTitle(text: string): boolean {
  return /[A-Z]{2}/.test(text) && text === text.toUpperCase();
}

/** Index of the rectangle whose horizontal centre is closest to the screen's, or -1 when none. */
export function pickNearestToCentre(rects: { x: number; width: number }[], screenWidth: number): number {
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  rects.forEach((r, i) => {
    const distance = Math.abs(r.x + r.width / 2 - screenWidth / 2);
    if (r.width > 0 && distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}

/** The nine puzzle pieces and where each one goes. */
export const PUZZLE_PIECES = ['l1', 'l2', 'l3', 'c1', 'c2', 'c3', 'r1', 'r2', 'r3'] as const;
export type Piece = (typeof PUZZLE_PIECES)[number];

/**
 * A piece dropped on its own place turns invisible and the app counts it; a wrong drop snaps
 * back. Nothing on screen shows the count until all nine are placed.
 */
export class DragScreen extends Screen {
  protected readonly marker = 'Drag-drop-screen';

  async drag(piece: Piece, to: Piece = piece): Promise<void> {
    await this.byId(`drag-${piece}`).dragAndDrop(this.byId(`drop-${to}`), { duration: 400 });
  }

  /**
   * The success view is in the UI tree only while all nine pieces are placed. Presence is checked,
   * not visibility: the confetti drawn over it makes "displayed" flicker.
   */
  async isSolved(): Promise<boolean> {
    return this.byText('Congratulations').isExisting();
  }

  /**
   * Taps Retry until the puzzle comes back. The success view fires a confetti animation drawn on
   * top of it, which swallows taps for about three seconds, so a single tap can land on the confetti.
   */
  async retry(): Promise<void> {
    await this.driver.waitUntil(
      async () => {
        if (await this.byId('button-Retry').isExisting()) await this.byId('button-Retry').click();
        return !(await this.isSolved());
      },
      { timeout: 12_000, interval: 1_500, timeoutMsg: 'Retry did not bring the puzzle back' },
    );
  }
}

/**
 * The app's alert dialog. React Native shows it with AndroidX, so the title's ID belongs to the app
 * (`com.wdiodemoapp:id/alert_title`, checked on the emulator) while the message and the buttons keep
 * Android's own IDs: button1 is positive (the last one given), button2 negative, button3 neutral.
 * Android draws button labels in capitals, and UiAutomator2 reports them as drawn.
 */
export class NativeAlert extends Screen {
  /** Not used: the dialog has no accessibility ID; the methods below find it by resource ID. */
  protected readonly marker = 'alert';

  private get titleView() {
    return this.driver.$('android=new UiSelector().resourceIdMatches(".*:id/(alert_title|alertTitle)")');
  }

  override async waitUntilShown(timeout = 10_000): Promise<this> {
    await this.titleView.waitForDisplayed({ timeout, timeoutMsg: 'No alert appeared' });
    return this;
  }

  override async isShown(): Promise<boolean> {
    return this.titleView.isDisplayed();
  }

  async title(): Promise<string> {
    return this.titleView.getText();
  }

  async message(): Promise<string> {
    return this.byResourceId('android:id/message').getText();
  }

  /** The button labels, left to right, as drawn (capitals). */
  async buttons(): Promise<string[]> {
    const labels: string[] = [];
    for (const id of ['android:id/button3', 'android:id/button2', 'android:id/button1']) {
      const button = this.byResourceId(id);
      if (await button.isExisting()) labels.push(await button.getText());
    }
    return labels;
  }

  /** Taps a button by its label, in any letter case. */
  async tap(label: string): Promise<void> {
    const pattern = `(?i)^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
    await this.driver
      .$(
        `android=new UiSelector().resourceIdMatches("android:id/button[123]").textMatches(${JSON.stringify(pattern)})`,
      )
      .click();
  }
}

/** All screens of the demo app, built on one session. */
export function demoApp(driver: Browser) {
  return {
    nav: new Navigation(driver),
    home: new HomeScreen(driver),
    permissions: new PermissionsScreen(driver),
    data: new DataScreen(driver),
    login: new LoginScreen(driver),
    forms: new FormsScreen(driver),
    swipe: new SwipeScreen(driver),
    drag: new DragScreen(driver),
    alert: new NativeAlert(driver),
  };
}

export type DemoApp = ReturnType<typeof demoApp>;
