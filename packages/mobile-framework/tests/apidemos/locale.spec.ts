import { expect, test } from '../../src/fixtures';
import { ACTIVITY } from '../../src/screens/apidemos';

// Android 13's per-app language: ApiDemos' own texts are English only, but the system views it
// shows (the date picker and its buttons) follow the language the app is set to.

test.describe('The app in another language', { tag: ['@mobile', '@android'] }, () => {
  test.afterEach(async ({ app }) => {
    await app.setLanguage(undefined);
  });

  test('in French, the date picker shows French buttons, French dates and weeks from Monday', async ({
    app,
    api,
  }) => {
    await app.open(ACTIVITY.dateWidgets);
    await api.dateWidgets.waitUntilShown();
    const [month = 1, , year = 2000] = (await api.dateWidgets.shownDateTime())
      .split(' ')[0]!
      .split('-')
      .map(Number);
    await api.dateWidgets.openDatePicker();
    expect(await api.dateWidgets.dialogButton('negative')).toBe('Cancel');
    expect(weekday(year, month, await api.dateWidgets.dayInFirstColumn())).toBe('Sunday');
    await api.dateWidgets.cancel();

    await app.setLanguage('fr-FR');
    await app.open(ACTIVITY.dateWidgets); // Android restarted the app with the new language
    await api.dateWidgets.waitUntilShown();
    await api.dateWidgets.openDatePicker();

    expect(await api.dateWidgets.dialogButton('negative')).toBe('Annuler');
    expect(await api.dateWidgets.pickerHeaderDate()).toMatch(/^[a-zéû]+\. \d{1,2} [a-zéû]+\.?$/i);
    expect(weekday(year, month, await api.dateWidgets.dayInFirstColumn())).toBe('Monday');
  });
});

function weekday(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    weekday: 'long',
    timeZone: 'UTC',
  });
}
