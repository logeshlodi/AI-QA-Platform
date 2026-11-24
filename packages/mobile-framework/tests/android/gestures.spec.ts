import { expect, test } from '../../src/fixtures';
import { PUZZLE_PIECES } from '../../src/screens/demo-app';

test.describe('Swipe, scroll and drag', { tag: ['@mobile', '@android'] }, () => {
  test('swiping the carousel left shows the next card, and right brings the first one back', async ({
    screens,
  }) => {
    await screens.nav.open('Swipe');
    await screens.swipe.waitUntilShown();
    // The app shows card titles in capitals (SliderEntry upper-cases them).
    expect(await screens.swipe.currentCardTitle()).toBe('FULLY OPEN SOURCE');

    await screens.swipe.swipeCarousel('left');
    await expect.poll(() => screens.swipe.currentCardTitle()).toBe('GREAT COMMUNITY');

    await screens.swipe.swipeCarousel('right');
    await expect.poll(() => screens.swipe.currentCardTitle()).toBe('FULLY OPEN SOURCE');
  });

  test('scrolling down finds what is hidden below the fold', async ({ screens }) => {
    await screens.nav.open('Swipe');
    await screens.swipe.waitUntilShown();
    expect(await screens.swipe.isLogoShown()).toBe(false);

    await screens.swipe.scrollToHiddenLogo();
    await expect.poll(() => screens.swipe.isLogoShown()).toBe(true);
    expect(await screens.swipe.showsText('You found me!!!')).toBe(true);
  });

  test('dragging every piece to its place solves the puzzle, and Retry starts again', async ({ screens }) => {
    await screens.nav.open('Drag');
    await screens.drag.waitUntilShown();
    for (const piece of PUZZLE_PIECES) await screens.drag.drag(piece);

    await expect.poll(() => screens.drag.isSolved()).toBe(true);
    await screens.drag.retry();
    await expect.poll(() => screens.drag.isSolved()).toBe(false);
  });

  test('a piece dropped in the wrong place does not count', async ({ screens }) => {
    await screens.nav.open('Drag');
    await screens.drag.waitUntilShown();
    await screens.drag.drag('l1', 'c1');
    for (const piece of PUZZLE_PIECES.filter((p) => p !== 'l1')) await screens.drag.drag(piece);
    expect(await screens.drag.isSolved()).toBe(false);

    await screens.drag.drag('l1');
    await expect.poll(() => screens.drag.isSolved()).toBe(true);
  });
});
