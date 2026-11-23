# Test Plan: SauceDemo Inventory Page: Sorting, Add/Remove, Cart Badge

## Application Overview

The inventory page (https://www.saucedemo.com/inventory.html) lists 6 products. Each card has a name, description,
price and one toggle button that switches between **Add to cart** and **Remove**. A sort dropdown
(`product-sort-container`) offers four orders. The header cart icon (`shopping-cart-link`) shows a numeric badge
(`shopping-cart-badge`) only when the cart holds at least one item. Cart state is kept in `localStorage`, so it
survives reloads. The sort choice does not survive a reload.

Observed catalog (default order, Name A to Z):

| #   | Product                           | Price  | Add button `data-test`                          |
| --- | --------------------------------- | ------ | ----------------------------------------------- |
| 1   | Sauce Labs Backpack               | $29.99 | `add-to-cart-sauce-labs-backpack`               |
| 2   | Sauce Labs Bike Light             | $9.99  | `add-to-cart-sauce-labs-bike-light`             |
| 3   | Sauce Labs Bolt T-Shirt           | $15.99 | `add-to-cart-sauce-labs-bolt-t-shirt`           |
| 4   | Sauce Labs Fleece Jacket          | $49.99 | `add-to-cart-sauce-labs-fleece-jacket`          |
| 5   | Sauce Labs Onesie                 | $7.99  | `add-to-cart-sauce-labs-onesie`                 |
| 6   | Test.allTheThings() T-Shirt (Red) | $15.99 | `add-to-cart-test.allthethings()-t-shirt-(red)` |

The Remove button uses the same suffix with a `remove-` prefix. Two products share the price $15.99, so price-sort
assertions must check that prices never decrease (or never increase), not a fixed order between those two.

## Starting State

**Seed:** `tests/seed.spec.ts`. It logs in as `standard_user` through `loginFlow.loginAs('standard')` and lands on
`/inventory.html` with the title "Products". Each scenario starts from a fresh browser context: empty cart, default
sort, no badge. Use the project fixtures (`inventoryPage`, `cartPage`, `inventoryPage.header`) rather than raw
selectors.

## Test Scenarios

### 1. Sorting

#### 1.1 Default sort is Name (A to Z)

**Seed:** `tests/seed.spec.ts`

**Steps:**

1. Read the active sort label (`active-option`).
2. Read all product names in display order.

**Expected Results:**

- The active label is "Name (A to Z)" and the dropdown value is `az`.
- The dropdown has exactly four options, in this order: `az` Name (A to Z), `za` Name (Z to A), `lohi` Price (low to high), `hilo` Price (high to low).
- 6 products are shown, and their names are in ascending alphabetical order.

#### 1.2 Sort by Name (Z to A)

**Seed:** `tests/seed.spec.ts`

**Steps:**

1. Select `za` in the sort dropdown.
2. Read all product names.

**Expected Results:**

- The active label is "Name (Z to A)".
- Names are in descending order: first "Test.allTheThings() T-Shirt (Red)", last "Sauce Labs Backpack".
- Still exactly 6 products. None are lost or duplicated.

#### 1.3 Sort by Price (low to high)

**Seed:** `tests/seed.spec.ts`

**Steps:**

1. Select `lohi`.
2. Read all prices (`inventoryPage.prices()`).

**Expected Results:**

- The active label is "Price (low to high)".
- Prices never decrease from one product to the next: 7.99, 9.99, 15.99, 15.99, 29.99, 49.99.
- First product is "Sauce Labs Onesie", last is "Sauce Labs Fleece Jacket".

#### 1.4 Sort by Price (high to low)

**Seed:** `tests/seed.spec.ts`

**Steps:**

1. Select `hilo`.
2. Read all prices.

**Expected Results:**

- The active label is "Price (high to low)".
- Prices never increase from one product to the next: 49.99, 29.99, 15.99, 15.99, 9.99, 7.99.
- First product is "Sauce Labs Fleece Jacket", last is "Sauce Labs Onesie".

#### 1.5 Switching sorts several times in a row

**Seed:** `tests/seed.spec.ts`

**Steps:**

1. Select `hilo`, then `za`, then `lohi`, then `az`.
2. After each selection, check the order.

**Expected Results:**

- After each change the list matches that sort's expected order (as in 1.1 to 1.4). Nothing left over from the previous sort affects the result.
- After returning to `az`, the order matches the default order exactly.

#### 1.6 Sort resets to default after reload (edge case)

**Seed:** `tests/seed.spec.ts`

**Steps:**

1. Select `hilo`.
2. Reload the page.

**Expected Results:**

- The active label is back to "Name (A to Z)" and products are in A to Z order. This is current behavior: the sort choice is not saved.

#### 1.7 Sorting keeps cart state on each card

**Seed:** `tests/seed.spec.ts`

**Steps:**

1. Add "Sauce Labs Onesie" and "Sauce Labs Fleece Jacket" to the cart.
2. Select `lohi`, then `hilo`.

**Expected Results:**

- Badge stays at "2" after each sort.
- After each sort, the Onesie and Fleece Jacket cards (now at different positions) still show **Remove**. The other 4 show **Add to cart**. Cart state follows the product, not its position on the page.

### 2. Adding and Removing Products

#### 2.1 Add a single product

**Seed:** `tests/seed.spec.ts`

**Steps:**

1. Confirm there is no badge.
2. Click **Add to cart** on "Sauce Labs Backpack".

**Expected Results:**

- The Backpack button text becomes "Remove" (`remove-sauce-labs-backpack`).
- Badge appears with text "1".
- The other 5 cards still show "Add to cart".

#### 2.2 Remove a product from the inventory page

**Seed:** `tests/seed.spec.ts`

**Steps:**

1. Add "Sauce Labs Backpack".
2. Click **Remove** on the same card.

**Expected Results:**

- The button goes back to "Add to cart".
- Badge is removed from the page. It is not shown as "0".

#### 2.3 Add all six products

**Seed:** `tests/seed.spec.ts`

**Steps:**

1. Click **Add to cart** on each of the 6 cards one at a time, checking the badge after each click.

**Expected Results:**

- After each click the badge goes up by one: 1, 2, 3, 4, 5, 6.
- All 6 buttons show "Remove". No "Add to cart" button is left.

#### 2.4 Remove products in a different order than they were added

**Seed:** `tests/seed.spec.ts`

**Steps:**

1. Add Backpack, Bike Light, Bolt T-Shirt.
2. Remove Bike Light (the middle one), then Backpack, then Bolt T-Shirt.

**Expected Results:**

- Badge goes 3, 2, 1, then disappears.
- Only the products you removed switch back to "Add to cart". The others stay on "Remove".

#### 2.5 Add, remove, add the same product again (toggle stability)

**Seed:** `tests/seed.spec.ts`

**Steps:**

1. Toggle "Sauce Labs Bike Light" Add, Remove, Add.

**Expected Results:**

- Badge ends at "1", not 2. The product is never counted twice.
- Button ends as "Remove".

#### 2.6 Products added on the inventory page appear in the cart

**Seed:** `tests/seed.spec.ts`

**Steps:**

1. Add "Sauce Labs Backpack" and "Sauce Labs Bike Light".
2. Click the cart icon.

**Expected Results:**

- URL is `/cart.html`.
- The cart lists exactly those 2 items, with the same names and prices shown on the inventory page.

#### 2.7 Removing an item in the cart updates the inventory page

**Seed:** `tests/seed.spec.ts`

**Steps:**

1. Add Backpack and Bike Light, then open the cart.
2. Remove Backpack in the cart.
3. Click **Continue Shopping**.

**Expected Results:**

- Back on `/inventory.html`: Backpack shows "Add to cart", Bike Light shows "Remove", badge is "1".

#### 2.8 Cart state stays the same on the product detail page

**Seed:** `tests/seed.spec.ts`

**Steps:**

1. Add "Sauce Labs Backpack".
2. Click its product name to open `/inventory-item.html?id=4`.
3. Click **Remove** on the detail page, then **Back to products**.

**Expected Results:**

- The detail page first shows "Remove" and a badge of "1".
- After removing it there, the badge is gone and the Backpack card on the inventory page shows "Add to cart".

### 3. Cart Badge

#### 3.1 No badge on a fresh session

**Seed:** `tests/seed.spec.ts`

**Steps:**

1. Check the header right after login.

**Expected Results:**

- `shopping-cart-badge` does not exist in the page (count 0). The cart link is visible and can be clicked.

#### 3.2 Badge survives page reload

**Seed:** `tests/seed.spec.ts`

**Steps:**

1. Add 2 products.
2. Reload the page.

**Expected Results:**

- Badge is still "2". The same 2 cards still show "Remove".

#### 3.3 Badge survives navigating to the cart and back

**Seed:** `tests/seed.spec.ts`

**Steps:**

1. Add 3 products.
2. Open the cart, then click **Continue Shopping**.

**Expected Results:**

- Badge reads "3" on the cart page and again on the inventory page.

#### 3.4 Reset App State clears the badge (known issue)

**Seed:** `tests/seed.spec.ts`

**Steps:**

1. Add "Sauce Labs Onesie" (badge "1").
2. Open the menu (**Open Menu**) and click **Reset App State** (`reset-sidebar-link`).
3. Read the Onesie button, then reload and read it again.

**Expected Results:**

- Badge disappears right away.
- **Known issue (seen during exploration):** before the reload, the Onesie card still shows "Remove" even though the cart is empty. After the reload it shows "Add to cart". Assert the badge only, and record the stale button as a known SauceDemo defect: mark that assertion `test.fail()` or leave it out. Don't let it make this test flaky.

#### 3.5 Badge returns after logout and login (session persistence)

**Seed:** `tests/seed.spec.ts`

**Steps:**

1. Add 1 product.
2. Log out from the menu, then log in again as `standard_user` in the same browser context.

**Expected Results:**

- Badge shows "1" again, because the cart is kept in `localStorage` and logout does not clear it. If this changes, it is a change in product behavior, not a test defect.

### 4. Negative and Access Scenarios

#### 4.1 Inventory page is blocked without login

**Seed:** none (fresh context, not logged in)

**Steps:**

1. Go directly to `/inventory.html`.

**Expected Results:**

- The browser is redirected to the login page (`/`).
- Error reads: "Epic sadface: You can only access '/inventory.html' when you are logged in."
- No products, no sort dropdown and no cart badge are shown.

#### 4.2 Sort is broken for `problem_user` (negative)

**Seed:** `tests/seed.spec.ts`, but log in with `loginFlow.loginAs('problem')`

**Steps:**

1. Select `za`.

**Expected Results:**

- An order of products that does not match "Name (Z to A)" counts as an expected failure for this user, which is a deliberate SauceDemo fault. Use this scenario to check that the sort assertions actually catch a wrong order. Mark it `test.fail()`.

#### 4.3 Remove does not work for `error_user` (negative)

**Seed:** `tests/seed.spec.ts`, but log in with `loginFlow.loginAs('error')`

**Steps:**

1. Add "Sauce Labs Backpack".
2. Click **Remove** on it.

**Expected Results:**

- Expected correct behavior: badge disappears and button goes back to "Add to cart". For `error_user` this fails on purpose. Mark it `test.fail()` so it shows that the badge/button assertions detect an add/remove that silently fails.

## Notes for the Generator

- Prefer `inventoryPage.sortBy()`, `inventoryPage.addToCart()`, `inventoryPage.card(name)` and `inventoryPage.prices()` over raw locators.
- Check that the badge is gone with `toHaveCount(0)` / `toBeHidden()`, not by checking its text is empty.
- For price sorts, compare against a sorted copy of the values. Don't hard-code the order of the two $15.99 shirts.
- Scenarios 4.2 and 4.3 depend on SauceDemo's deliberately faulty users. Confirm what those users actually do before generating code, because SauceDemo changes which faults each user has from time to time.
