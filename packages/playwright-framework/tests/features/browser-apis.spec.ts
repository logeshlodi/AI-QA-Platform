import { expect, test } from '../../src/fixtures';
import { html, LOCAL_ORIGIN, serveLocal } from '../../src/local/site';

/**
 * Browser APIs that need a permission or a device: clipboard and passkeys (WebAuthn); notifications
 * and the camera and microphone have files of their own (they need launch settings). Each runs on a local secure origin (src/local/site.ts), so no public site is
 * involved. Chromium only: the permission names, and the virtual authenticator are Chromium features.
 */
test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium permissions, CDP and fake devices');

test.describe('clipboard', () => {
  test('a copy button puts text on the clipboard, and paste puts it in a field', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: LOCAL_ORIGIN });
    await serveLocal(page, {
      '/': html(
        'Clipboard',
        `<p id="code">AIQA-7731</p>
         <button onclick="navigator.clipboard.writeText(document.getElementById('code').textContent)
           .then(() => (document.getElementById('status').textContent = 'Copied'))">Copy code</button>
         <span id="status" role="status"></span>
         <label>Paste here <input id="target"></label>`,
      ),
    });
    await page.goto(`${LOCAL_ORIGIN}/`);

    await page.getByRole('button', { name: 'Copy code' }).click();
    await expect(page.getByRole('status')).toHaveText('Copied');
    // Read it back the way the page would: through the Clipboard API.
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('AIQA-7731');

    // And the way a person would: focus the field and paste.
    const field = page.getByLabel('Paste here');
    await field.focus();
    await page.keyboard.press('ControlOrMeta+V');
    await expect(field).toHaveValue('AIQA-7731');
  });

  test('without permission the page cannot read the clipboard', async ({ page }) => {
    await serveLocal(page, { '/': html('Clipboard', '<p>No grant</p>') });
    await page.goto(`${LOCAL_ORIGIN}/`);
    const result = await page.evaluate(() =>
      navigator.clipboard.readText().then(
        () => 'read',
        (error: Error) => error.name,
      ),
    );
    expect(result).toBe('NotAllowedError');
  });
});

test.describe('passkeys (WebAuthn) with a virtual authenticator', () => {
  test('registers a passkey, then signs in with it', async ({ page }) => {
    await serveLocal(page, { '/': html('Passkeys', '<h1>Sign in with a passkey</h1>') });
    await page.goto(`${LOCAL_ORIGIN}/`);

    // A software authenticator in the browser, through the DevTools protocol: no hardware key needed.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
      },
    });

    const signCount = async () =>
      (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials[0]?.signCount ?? 0;
    const registered = await page.evaluate(async () => {
      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'AI-QA shop', id: 'localhost' },
          user: { id: new TextEncoder().encode('user-42'), name: 'qa@example.com', displayName: 'QA' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        },
      })) as PublicKeyCredential;
      return { id: credential.id, type: credential.type };
    });
    expect(registered.type).toBe('public-key');
    const afterRegistering = await signCount();

    const signedIn = await page.evaluate(async () => {
      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rpId: 'localhost',
          userVerification: 'required',
        },
      })) as PublicKeyCredential;
      return assertion.id;
    });
    expect(signedIn).toBe(registered.id);

    // The authenticator holds one passkey for this site, and signing in counted one more signature:
    // the counter is how a server spots a cloned authenticator.
    const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
    expect(credentials).toHaveLength(1);
    expect(credentials[0]).toMatchObject({ rpId: 'localhost', isResidentCredential: true });
    expect(await signCount()).toBe(afterRegistering + 1);
  });
});
