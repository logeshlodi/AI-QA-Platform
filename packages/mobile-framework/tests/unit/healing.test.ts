import { HealingEngine, proposeLocatorPatch } from '@aiqa/self-healing-engine';
import { describe, expect, it } from 'vitest';
import {
  describeAndroid,
  findNode,
  parseSourceLocator,
  selectorFor,
  sourceFor,
  suggestScreenLocator,
  describeNode,
} from '../../src/healing';

// The demo app's sign-in button as UiAutomator2 reports it: a ViewGroup carrying the accessibility
// ID, with the label in a TextView inside it.
const screen = (loginId: string) => `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy index="0" rotation="0">
  <android.widget.FrameLayout class="android.widget.FrameLayout" resource-id="" text="" content-desc="" clickable="false" displayed="true" bounds="[0,0][1080,2400]">
    <android.view.View class="android.view.View" resource-id="android:id/statusBarBackground" text="" content-desc="" clickable="false" displayed="true" bounds="[0,0][1080,136]"/>
    <android.view.ViewGroup class="android.view.ViewGroup" resource-id="" text="" content-desc="Login-screen" clickable="false" displayed="true" bounds="[0,136][1080,2337]">
      <android.widget.EditText class="android.widget.EditText" resource-id="" text="Email" content-desc="input-email" clickable="true" displayed="true" bounds="[80,900][1000,1030]"/>
      <android.widget.EditText class="android.widget.EditText" resource-id="" text="Password" content-desc="input-password" clickable="true" displayed="true" bounds="[80,1060][1000,1190]"/>
      <android.view.ViewGroup class="android.view.ViewGroup" resource-id="" text="" content-desc="${loginId}" clickable="true" displayed="true" bounds="[80,1300][1000,1430]">
        <android.widget.TextView class="android.widget.TextView" resource-id="" text="LOGIN" content-desc="" clickable="false" displayed="true" bounds="[450,1330][630,1400]"/>
      </android.view.ViewGroup>
    </android.view.ViewGroup>
  </android.widget.FrameLayout>
</hierarchy>`;

describe('healing for screen objects', () => {
  it('describes each nameable view, reading a button by the text inside it, and skips the system bars', () => {
    const elements = describeAndroid(screen('button-LOGIN'));
    const login = elements.find((e) => e.accessibleName === 'button-LOGIN')!;
    expect(login).toMatchObject({
      role: 'ViewGroup',
      text: 'LOGIN',
      testId: '',
      cssPath: "byId('button-LOGIN')",
    });
    expect(login.ancestorPath).toBe('hierarchy>FrameLayout>ViewGroup>ViewGroup');
    expect(elements.some((e) => e.testId.includes('statusBar'))).toBe(false);
  });

  it('writes the fix as screen-object code, best locator first, and reads it back', () => {
    expect(
      suggestScreenLocator({ accessibleName: 'button-LOGIN', testId: 'app:id/login', text: 'LOGIN' }),
    ).toBe("byId('button-LOGIN')");
    expect(suggestScreenLocator({ accessibleName: '', testId: 'app:id/login', text: 'LOGIN' })).toBe(
      "byResourceId('app:id/login')",
    );
    expect(suggestScreenLocator({ accessibleName: '', testId: '', text: 'LOGIN' })).toBe("byText('LOGIN')");
    expect(parseSourceLocator("byText('it\\'s here')")).toEqual({ method: 'byText', value: "it's here" });
    expect(parseSourceLocator('this.driver.$("//x")')).toBeUndefined();
    expect(selectorFor('byId', 'button-LOGIN')).toBe('~button-LOGIN');
    expect(selectorFor('byResourceId', 'a:id/b')).toBe('android=new UiSelector().resourceId("a:id/b")');
    expect(sourceFor('byId', 'button-LOGIN')).toBe("byId('button-LOGIN')");
  });

  it('finds a renamed accessibility ID again, and proposes a one-line patch to the screen object', async () => {
    const node = findNode(screen('button-LOGIN'), 'byId', 'button-LOGIN')!;
    const fingerprint = {
      ...describeNode(node),
      locatorKey: 'LoginScreen.loginButton',
      selector: "byId('button-LOGIN')",
      pageUrl: '.MainActivity',
      updatedAt: '2026-11-24T00:00:00.000Z',
    };
    const engine = new HealingEngine({ suggest: suggestScreenLocator });
    const decision = await engine.heal(fingerprint, describeAndroid(screen('button-SIGN-IN')));
    expect(decision.outcome).toBe('healed');
    expect(decision.candidate?.suggestion).toBe("byId('button-SIGN-IN')");

    const source = {
      path: 'src/screens/demo-app.ts',
      text: "  async submitLogin(): Promise<void> {\n    await (await this.locate('LoginScreen.loginButton', 'byId', 'button-LOGIN')).click();\n    await this.byId('button-LOGIN').click();\n  }",
    };
    const proposal = proposeLocatorPatch(
      {
        locatorKey: 'LoginScreen.loginButton',
        testId: 't',
        failedSelector: "byId('button-LOGIN')",
        suggestion: decision.candidate!.suggestion,
        strategy: decision.candidate!.strategy,
        score: decision.candidate!.score,
        outcome: 'healed',
        createdAt: '2026-11-24T00:00:00.000Z',
      },
      [source],
    );
    expect(proposal).toMatchObject({
      status: 'ready',
      patch: { line: 3, after: "    await this.byId('button-SIGN-IN').click();" },
    });
  });

  it('refuses when the button is gone and nothing on the screen resembles it', async () => {
    const node = findNode(screen('button-LOGIN'), 'byId', 'button-LOGIN')!;
    const engine = new HealingEngine({ suggest: suggestScreenLocator });
    const empty = screen('button-LOGIN').replace(
      /<android\.view\.ViewGroup class="android\.view\.ViewGroup" resource-id="" text="" content-desc="button-LOGIN"[\s\S]*?<\/android\.view\.ViewGroup>/,
      '',
    );
    const decision = await engine.heal(
      { ...describeNode(node), locatorKey: 'k', selector: 's', pageUrl: '', updatedAt: '' },
      describeAndroid(empty),
    );
    expect(decision.outcome).toBe('refused');
  });
});
