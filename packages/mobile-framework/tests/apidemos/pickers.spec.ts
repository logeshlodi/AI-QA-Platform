import { expect, test } from '../../src/fixtures';
import { ACTIVITY } from '../../src/screens/apidemos';

// Android's own date and time pickers, opened from ApiDemos. The screen shows the chosen value as
// `M-D-YYYY HH:MM`, so each test reads what the user would read after pressing OK.

/** The date line's month, day and year (`11-24-2026 01:02`). */
function parts(shown: string) {
  const [month = 0, day = 0, year = 0] = shown.split(' ')[0]!.split('-').map(Number);
  return { month, day, year, time: shown.split(' ')[1] };
}

test.describe('Date and time pickers', { tag: ['@mobile', '@android'] }, () => {
  test.beforeEach(async ({ app, api }) => {
    await app.open(ACTIVITY.dateWidgets);
    await api.dateWidgets.waitUntilShown();
  });

  test('a day picked in next month is the date shown after OK', async ({ api }) => {
    const before = parts(await api.dateWidgets.shownDateTime());
    const next =
      before.month === 12
        ? { month: 1, year: before.year + 1 }
        : { month: before.month + 1, year: before.year };

    await api.dateWidgets.openDatePicker();
    await api.dateWidgets.nextMonth();
    await api.dateWidgets.pickDay(15);
    await api.dateWidgets.confirm();

    await expect
      .poll(() => api.dateWidgets.shownDateTime())
      .toBe(`${next.month}-15-${next.year} ${before.time}`);
  });

  test('a time picked on the clock face is the time shown after OK', async ({ api }) => {
    const before = parts(await api.dateWidgets.shownDateTime());

    await api.dateWidgets.openTimePicker();
    await api.dateWidgets.pickTime(7, 30, 'PM');
    await api.dateWidgets.confirm();

    await expect
      .poll(() => api.dateWidgets.shownDateTime())
      .toBe(`${before.month}-${before.day}-${before.year} 19:30`);
  });

  test('Cancel leaves the date as it was', async ({ api }) => {
    const before = await api.dateWidgets.shownDateTime();

    await api.dateWidgets.openDatePicker();
    await api.dateWidgets.nextMonth();
    await api.dateWidgets.pickDay(15);
    await api.dateWidgets.cancel();

    expect(await api.dateWidgets.shownDateTime()).toBe(before);
  });
});
