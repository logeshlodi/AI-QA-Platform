# Test Plan for Sorting Products and Cart Badge on Sauce Labs Inventory Page

## Application Overview

This test plan focuses on verifying the functionality of sorting products and the cart badge on the Sauce Labs inventory page. The scenarios include the main happy path, an edge case, and a negative case.

Page: https://www.saucedemo.com/inventory.html

## Test Scenarios

### 1. Main Happy Path

**Seed:** `tests/seed.spec.ts`

#### Steps

1. Click on the 'Sort products' combobox
2. Select the 'Price (low to high)' option
3. Verify that the products are sorted by price in ascending order
4. Click on the 'Add to cart' button for the first product
5. Verify that the cart badge displays the number '1'

#### Expected Results

- The combobox opens with the 'Price (low to high)' option selected
- The products are displayed in ascending order of price
- The cart badge updates to '1' after adding the first product

### 2. Edge Case: Sorting by Name (Z to A)

**Seed:** `tests/seed.spec.ts`

#### Steps

1. Click on the 'Sort products' combobox
2. Select the 'Name (Z to A)' option
3. Verify that the products are sorted by name in descending order
4. Click on the 'Add to cart' button for the first product
5. Verify that the cart badge displays the number '1'

#### Expected Results

- The combobox opens with the 'Name (Z to A)' option selected
- The products are displayed in descending order of name
- The cart badge updates to '1' after adding the first product

### 3. Negative Case: Attempting to Add to Cart with an Empty Cart

**Seed:** `tests/seed.spec.ts`

#### Steps

1. Click on the 'Cart, empty' button
2. Click on the 'Add to cart' button for the first product
3. Verify that the cart badge displays the number '1'

#### Expected Results

- The cart badge updates to '1' after adding the first product
