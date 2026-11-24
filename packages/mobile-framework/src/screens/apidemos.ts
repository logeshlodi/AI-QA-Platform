import type { Browser } from 'webdriverio';
import { Screen } from './screen';

// Screen objects for Appium's ApiDemos 6.0.18: classic Android views (no React Native). IDs and
// messages come from its source (appium/android-apidemos, app/src/main): layouts under res/layout,
// strings in res/values/strings.xml, behaviour in java/io/appium/android/apis.

export const APIDEMOS = 'io.appium.android.apis';
const id = (name: string) => `${APIDEMOS}:id/${name}`;

/** Activities the specs open directly, as `mobile: startActivity` wants them. */
export const ACTIVITY = {
  home: '.ApiDemos',
  controls: '.view.Controls1',
  seekBar: '.view.SeekBar1',
  ratingBar: '.view.RatingBar1',
  popupMenu: '.view.PopupMenu1',
  expandableList: '.view.ExpandableList1',
  toast: '.app.NotifyWithText',
} as const;
export type ApiDemosActivity = keyof typeof ACTIVITY;

abstract class ApiDemosScreen extends Screen {
  protected byAppId(name: string) {
    return this.byResourceId(id(name));
  }
}

/** The start list: Accessibility, Animation, App, Content, Graphics, Media, NFC, OS, Preference, Text, Views. */
export class ApiDemosHome extends ApiDemosScreen {
  protected readonly marker = 'unused';

  override async waitUntilShown(timeout = 20_000): Promise<this> {
    await this.byText('Views').waitForDisplayed({ timeout, timeoutMsg: 'The ApiDemos list did not show' });
    return this;
  }

  async open(entry: string): Promise<void> {
    await this.byText(entry).click();
  }

  /**
   * Brings a list entry on screen with Android's UiScrollable: the scrolling happens on the device,
   * in one command, however long the list is. Works for any scrollable list in any app.
   */
  async scrollTo(text: string): Promise<void> {
    await this.driver
      .$(
        `android=new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().text(${JSON.stringify(text)}))`,
      )
      .waitForDisplayed();
  }

  async shows(text: string): Promise<boolean> {
    return this.byText(text).isDisplayed();
  }
}

/** Views > Controls > 1. Light Theme: check boxes, radio buttons, a toggle, a spinner, text fields. */
export class ControlsScreen extends ApiDemosScreen {
  protected readonly marker = 'unused';
  static readonly PLANETS = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];

  override async waitUntilShown(timeout = 15_000): Promise<this> {
    await this.byAppId('check1').waitForDisplayed({ timeout });
    return this;
  }

  async type(text: string): Promise<void> {
    await this.byAppId('edit').setValue(text);
    await this.hideKeyboard();
  }

  async text(): Promise<string> {
    return this.byAppId('edit').getText();
  }

  /** Focuses the text field (for pasting), with the keyboard up. */
  async focusText(): Promise<void> {
    await this.byAppId('edit').click();
  }

  async toggle(
    name: 'check1' | 'check2' | 'radio1' | 'radio2' | 'star' | 'toggle1' | 'toggle2',
  ): Promise<void> {
    await this.byAppId(name).click();
  }

  async isChecked(
    name: 'check1' | 'check2' | 'radio1' | 'radio2' | 'star' | 'toggle1' | 'toggle2',
  ): Promise<boolean> {
    return (await this.byAppId(name).getAttribute('checked')) === 'true';
  }

  /** The toggle button shows ON or OFF as its text. */
  async toggleText(name: 'toggle1' | 'toggle2'): Promise<string> {
    return this.byAppId(name).getText();
  }

  async pickPlanet(planet: string): Promise<void> {
    await this.byAppId('spinner1').click();
    await this.byText(planet).click();
  }

  async planet(): Promise<string> {
    return this.byAppId('spinner1').$('android=new UiSelector().resourceId("android:id/text1")').getText();
  }

  async isDisabledSaveEnabled(): Promise<boolean> {
    return this.byAppId('button_disabled').isEnabled();
  }
}

/** Views > Seek Bar: a 0-100 slider starting at 50; the app reports "<n> from touch=true". */
export class SeekBarScreen extends ApiDemosScreen {
  protected readonly marker = 'unused';

  override async waitUntilShown(timeout = 15_000): Promise<this> {
    await this.byAppId('seek').waitForDisplayed({ timeout });
    return this;
  }

  /** Taps the slider at a fraction of its width (0 = left end, 1 = right end). */
  async tapAt(fraction: number): Promise<void> {
    const bar = this.byAppId('seek');
    const { x, y } = await bar.getLocation();
    const { width, height } = await bar.getSize();
    await this.driver.tap({ x: Math.round(x + width * fraction), y: Math.round(y + height / 2) });
  }

  /** The slider's own value, as Android reports it to accessibility services. */
  async value(): Promise<number> {
    return Number(await this.byAppId('seek').getText());
  }

  async progressText(): Promise<string> {
    return this.byAppId('progress').getText();
  }
}

/** Views > Rating Bar: two editable bars (3 and 5 stars); the app reports "Rating: <n>/<stars>". */
export class RatingBarScreen extends ApiDemosScreen {
  protected readonly marker = 'unused';

  override async waitUntilShown(timeout = 15_000): Promise<this> {
    await this.byAppId('ratingbar2').waitForDisplayed({ timeout });
    return this;
  }

  /** Taps the n-th star of the five-star bar, in its middle. */
  async rate(stars: number): Promise<void> {
    const bar = this.byAppId('ratingbar2');
    const { x, y } = await bar.getLocation();
    const { width, height } = await bar.getSize();
    await this.driver.tap({ x: Math.round(x + (width * (stars - 0.5)) / 5), y: Math.round(y + height / 2) });
  }

  async ratingText(): Promise<string> {
    return this.byAppId('rating').getText();
  }
}

/** Views > Popup Menu: a button opening a menu; each item shows a toast. */
export class PopupMenuScreen extends ApiDemosScreen {
  protected readonly marker = 'unused';

  override async waitUntilShown(timeout = 15_000): Promise<this> {
    await this.byText('Make a Popup!').waitForDisplayed({ timeout });
    return this;
  }

  async openMenu(): Promise<void> {
    await this.byText('Make a Popup!').click();
  }

  async menuItems(): Promise<string[]> {
    const items = await this.driver.$$('android=new UiSelector().resourceId("android:id/title")');
    const labels: string[] = [];
    for (const item of items) labels.push(await item.getText());
    return labels;
  }

  async choose(item: string): Promise<void> {
    await this.driver
      .$(`android=new UiSelector().resourceId("android:id/title").text(${JSON.stringify(item)})`)
      .click();
  }
}

/** Views > Expandable Lists > 1. Custom Adapter: groups of names; a long press opens a context menu. */
export class ExpandableListScreen extends ApiDemosScreen {
  protected readonly marker = 'unused';

  override async waitUntilShown(timeout = 15_000): Promise<this> {
    await this.byText('People Names').waitForDisplayed({ timeout });
    return this;
  }

  async expand(group: string): Promise<void> {
    await this.byText(group).click();
  }

  async isShowing(name: string): Promise<boolean> {
    return this.byText(name).isDisplayed();
  }

  async longPress(name: string): Promise<void> {
    await this.byText(name).longPress({ duration: 1500 });
  }

  /** The context menu's header; it shares android:id/title with the menu items, so it is found by its text. */
  async showsMenuHeader(header: string): Promise<boolean> {
    return this.byText(header).isDisplayed();
  }

  async chooseMenuItem(item: string): Promise<void> {
    await this.byText(item).click();
  }
}

/** App > Notification > NotifyWithText: two buttons that each show a toast. */
export class ToastScreen extends ApiDemosScreen {
  protected readonly marker = 'unused';

  override async waitUntilShown(timeout = 15_000): Promise<this> {
    await this.byAppId('short_notify').waitForDisplayed({ timeout });
    return this;
  }

  async showShort(): Promise<void> {
    await this.byAppId('short_notify').click();
  }

  async showLong(): Promise<void> {
    await this.byAppId('long_notify').click();
  }
}

/**
 * The notification shade, which belongs to Android's System UI, not to the app. Opened with
 * Appium's openNotifications; closed with Back.
 */
export class NotificationShade extends Screen {
  protected readonly marker = 'unused';

  async open(): Promise<void> {
    await this.driver.openNotifications();
  }

  async close(): Promise<void> {
    await this.driver.execute('mobile: statusBar', { command: 'collapse' });
  }

  /** A notification whose title is this text (the sender, for a message). */
  /**
   * A lone notification shows its title in `android:id/title`; once an app has several, System UI
   * bundles them and each row's title moves to `com.android.systemui:id/notification_title`.
   */
  notificationTitled(title: string) {
    return this.driver.$(
      `android=new UiSelector().resourceIdMatches(".*:id/(title|notification_title)").text(${JSON.stringify(title)})`,
    );
  }

  /**
   * Posts a notification from Android's shell (`cmd notification post`). Used because ApiDemos'
   * own notifications never show on Android 13+: it targets SDK 33 without declaring
   * POST_NOTIFICATIONS, so Android blocks them (a defect in the app, recorded in STATUS).
   * Needs the server's `adb_shell` feature (see fixtures.ts).
   */
  async post(tag: string, title: string, text: string): Promise<void> {
    await this.driver.execute('mobile: shell', {
      command: 'cmd',
      args: ['notification', 'post', '-t', shellQuote(title), shellQuote(tag), shellQuote(text)],
    });
  }

  /**
   * Removes a notification by flicking its row to the side, as a user would. The fling runs across
   * the row's width at the title's height (the title text alone is too narrow for Android to take
   * it as a dismiss) and stays 10% clear of the screen edges, which are the back gesture. Once in
   * 4 runs the shade ignored the gesture, so it is repeated, up to 3 times, only while the
   * notification is still there.
   */
  async dismiss(title: string): Promise<void> {
    for (let attempt = 1; attempt <= 3 && (await this.has(title)); attempt++) {
      const row = await this.driver.getElementRect(await this.notificationTitled(title).elementId);
      const screen = await this.driver.getWindowSize();
      await this.driver.execute('mobile: flingGesture', {
        left: Math.round(screen.width * 0.1),
        top: row.y,
        width: Math.round(screen.width * 0.8),
        height: Math.max(row.height, 1),
        direction: 'right',
      });
      // The row slides away before it leaves the UI tree.
      await this.driver
        .waitUntil(async () => !(await this.has(title)), { timeout: 3_000, interval: 300 })
        .catch(() => undefined);
    }
  }

  async has(title: string): Promise<boolean> {
    return this.notificationTitled(title).isDisplayed();
  }

  async tap(title: string): Promise<void> {
    await this.notificationTitled(title).click();
  }
}

/**
 * Toasts: short system messages with no ID of their own. UiAutomator2 exposes the one on screen as
 * an android.widget.Toast element, which only XPath can name. The element goes stale as soon as it
 * is found (reading its text fails), so the text is matched inside the XPath and only existence is
 * checked. A toast lasts 2 to 3.5 s; it was found within half a second on the emulator.
 */
export async function waitForToast(driver: Browser, text: string, timeout = 5_000): Promise<string> {
  const toast = driver.$(`//android.widget.Toast[@text=${xpathLiteral(text)}]`);
  await driver.waitUntil(() => toast.isExisting(), {
    timeout,
    interval: 100,
    timeoutMsg: `No toast "${text}" within ${timeout / 1000} s`,
  });
  return text;
}

/** A string as an XPath 1.0 literal, quotes included (XPath has no escape character). */
export function xpathLiteral(text: string): string {
  if (!text.includes('"')) return `"${text}"`;
  if (!text.includes("'")) return `'${text}'`;
  return `concat(${text
    .split('"')
    .map((part) => `"${part}"`)
    .join(`, '"', `)})`;
}

/** One argument for the device's shell: `mobile: shell` joins arguments with spaces, so quote each. */
export function shellQuote(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

/** All ApiDemos screens, built on one session. */
export function apiDemos(driver: Browser) {
  return {
    home: new ApiDemosHome(driver),
    controls: new ControlsScreen(driver),
    seekBar: new SeekBarScreen(driver),
    ratingBar: new RatingBarScreen(driver),
    popupMenu: new PopupMenuScreen(driver),
    expandableList: new ExpandableListScreen(driver),
    toast: new ToastScreen(driver),
    shade: new NotificationShade(driver),
  };
}

export type ApiDemos = ReturnType<typeof apiDemos>;
