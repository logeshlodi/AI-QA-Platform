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

  async isInactiveEnabled(): Promise<boolean> {
    await this.scrollToButtons();
    return this.byId('button-Inactive').isEnabled();
  }

  /** The buttons sit below the fold on a phone-sized screen. */
  private async scrollToButtons(): Promise<void> {
    await this.byId('button-Active').scrollIntoView({ direction: 'down', maxScrolls: 5 });
  }
}

export class SwipeScreen extends Screen {
  protected readonly marker = 'Swipe-screen';

  /** The carousel has a testID, which React Native turns into a resource ID on Android. */
  private get carousel() {
    return this.byResourceId('Carousel');
  }

  async swipeCarousel(direction: 'left' | 'right'): Promise<void> {
    await this.driver.swipe({ direction, scrollableElement: this.carousel, percent: 0.8, duration: 600 });
  }

  /**
   * The title on the card in the middle of the screen. The carousel keeps its neighbours in the
   * UI tree (partly visible), so "is this text displayed" is not enough to say which card is current.
   */
  async currentCardTitle(): Promise<string> {
    const { width } = await this.driver.getWindowSize();
    const cards = await this.driver.$$('~card');
    const rects = [];
    for (const card of cards)
      rects.push({ card, rect: { ...(await card.getLocation()), ...(await card.getSize()) } });
    const centre = pickNearestToCentre(
      rects.map((r) => r.rect),
      width,
    );
    if (centre < 0) throw new Error('No carousel card on screen');
    const title = rects[centre]!.card.$(
      'android=new UiSelector().className("android.widget.TextView").instance(0)',
    );
    return title.getText();
  }

  /** Scrolls down until the hidden logo is on screen. */
  async scrollToHiddenLogo(): Promise<void> {
    await this.byId('WebdriverIO logo').scrollIntoView({ direction: 'down', maxScrolls: 6 });
  }

  async isLogoShown(): Promise<boolean> {
    return this.byId('WebdriverIO logo').isDisplayed();
  }
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

  async isSolved(): Promise<boolean> {
    return this.byText('Congratulations').isDisplayed();
  }

  async retry(): Promise<void> {
    await this.byId('button-Retry').click();
  }
}

/**
 * Android's system alert. Its views belong to the platform, so they are found by Android's own
 * resource IDs. Buttons: button1 is positive (the last one given), button2 negative, button3 neutral.
 */
export class NativeAlert extends Screen {
  /** Not used: an alert has no accessibility ID of the app's; the methods below find it by resource ID. */
  protected readonly marker = 'alert';

  override async waitUntilShown(timeout = 10_000): Promise<this> {
    await this.byResourceId('android:id/alertTitle').waitForDisplayed({
      timeout,
      timeoutMsg: 'No alert appeared',
    });
    return this;
  }

  override async isShown(): Promise<boolean> {
    return this.byResourceId('android:id/alertTitle').isDisplayed();
  }

  async title(): Promise<string> {
    return this.byResourceId('android:id/alertTitle').getText();
  }

  async message(): Promise<string> {
    return this.byResourceId('android:id/message').getText();
  }

  /** The labels of the buttons on the alert, left to right as Android lays them out. */
  async buttons(): Promise<string[]> {
    const labels: string[] = [];
    for (const id of ['android:id/button3', 'android:id/button2', 'android:id/button1']) {
      const button = this.byResourceId(id);
      if (await button.isExisting()) labels.push(await button.getText());
    }
    return labels;
  }

  async tap(label: string): Promise<void> {
    await this.driver
      .$(
        `android=new UiSelector().resourceIdMatches("android:id/button[123]").text(${JSON.stringify(label)})`,
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
