import { expect, test } from '../../src/fixtures';
import { LOGIN_ERRORS } from '../../src/screens/demo-app';

// The demo app checks the form on the device (no server): an email with an @ and a password of
// at least eight characters. A valid form shows a system alert after a pretend network call.

test.describe('Signing in and signing up', { tag: ['@mobile', '@android'] }, () => {
  test.beforeEach(async ({ screens }) => {
    await screens.nav.open('Login');
    await screens.login.waitUntilShown();
  });

  test('a valid email and password sign in, confirmed by an alert the user dismisses', async ({
    screens,
  }) => {
    await screens.login.fill('qa@example.com', 'correct-horse');
    await screens.login.submitLogin();

    await screens.alert.waitUntilShown();
    expect(await screens.alert.title()).toBe('Success');
    expect(await screens.alert.message()).toBe('You are logged in!');
    await screens.alert.tap('OK');
    await expect.poll(() => screens.alert.isShown()).toBe(false);
  });

  test('a bad email and a short password are both explained, and nothing is submitted', async ({
    screens,
  }) => {
    await screens.login.fill('not-an-email', 'short');
    await screens.login.submitLogin();

    await expect.poll(() => screens.login.showsText(LOGIN_ERRORS.email)).toBe(true);
    await expect.poll(() => screens.login.showsText(LOGIN_ERRORS.password)).toBe(true);
    expect(await screens.alert.isShown()).toBe(false);
  });

  test('the password field hides what is typed', async ({ screens }) => {
    expect(await screens.login.passwordFieldIsSecure()).toBe(true);
  });

  test('a new account needs the password typed twice, the same both times', async ({ screens }) => {
    await screens.login.switchToSignUp();
    await screens.login.fill('new@example.com', 'correct-horse', 'correct-hors');
    await screens.login.submitSignUp();
    await expect.poll(() => screens.login.showsText(LOGIN_ERRORS.repeat)).toBe(true);
  });

  test('signing up with matching passwords creates the account', async ({ screens }) => {
    await screens.login.switchToSignUp();
    await screens.login.fill('new@example.com', 'correct-horse', 'correct-horse');
    await screens.login.submitSignUp();

    await screens.alert.waitUntilShown();
    expect(await screens.alert.title()).toBe('Signed Up!');
    expect(await screens.alert.message()).toBe('You successfully signed up!');
    await screens.alert.tap('OK');
  });

  test('switching back from sign-up removes the repeat-password field', async ({ screens }) => {
    await screens.login.switchToSignUp();
    await screens.login.switchToLogin();
    await expect.poll(() => screens.login.isSignUpShown()).toBe(false);
  });
});
