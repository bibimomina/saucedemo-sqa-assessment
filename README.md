# SauceDemo checkout test

https://github.com/Hammadwakeel/saucedemo-sqa-assessment

End-to-end check for the primary SauceDemo account: log in as `standard_user`, add a backpack and a bike light, prove checkout rejects an empty form, then complete the order and prove the cart is empty.

The application under test is [https://www.saucedemo.com/](https://www.saucedemo.com/). The password for every published account is `secret_sauce`.

The defect report, prompt log, and QA strategy are in [ASSESSMENT.md](ASSESSMENT.md). Screenshots from the exploratory session are in `evidence/`.

## Setup

Requires Node.js 20 or newer.

```bash
npm install
npx playwright install chromium
npm test
```

Headed run:

```bash
npm run test:headed
```

## What the test protects

- Login lands on the inventory page and the catalog has 6 products.
- Adding the two products switches each button to Remove and sets the cart badge to 2.
- The cart shows the correct names, the shelf prices (`$29.99` and `$9.99`), and quantity 1.
- Continue with empty customer information stays on step one and shows `Error: First Name is required`.
- The overview total matches the catalog prices plus 8% tax rounded to cents: item total `$39.98`, tax `$3.20`, total `$43.18`.
- Finish shows `Thank you for your order!` and the cart badge and line items are gone.

Each test starts in a new browser context. That matters here because the cart is stored in `localStorage` and is not cleared on logout (see DEF-001 in the assessment).

## What AI generated, and what was changed

AI drafted the page objects, the flow, and the first selectors. Three things in that draft were wrong or too weak, and they were changed before this suite was trusted:

1. **Wrong test-id attribute.** The draft used `getByTestId`, which looks for `data-testid`. SauceDemo uses `data-test`. The first run failed on the login button while the login form was clearly on screen. `testIdAttribute: "data-test"` in `playwright.config.ts` is the fix. CSS class selectors were not used as a fallback. Classes such as `btn_primary` are shared, and `visual_user` adds `btn_visual_failure` to Checkout.
2. **The success string is not proof of the order.** `Thank you for your order!` is also shown when `standard_user` checks out an empty cart for `$0.00` (recorded in the assessment, not automated). The test now asserts the two line items, both prices, the tax math, and an empty cart afterwards.
3. **No fixed sleeps.** A draft added `waitForTimeout` "to be safe", including a 5 second pause copied from `performance_glitch_user`. This test uses `standard_user`. Playwright's auto-waiting assertions are enough. The 5 second delay was measured on the glitch account (about 5.1 seconds) and left out of this test on purpose.

## Limitations

- One browser (Chromium) and one happy-path account. The broken accounts (`problem_user`, `error_user`, `visual_user`) are documented as defects. They are not asserted in CI until the team agrees what the correct behaviour should be. Automating today's broken screen would freeze the bug in as the oracle.
- The tax check is the current rule: 8% of the item total, half-up to cents, then added back. If the business changes the rate or the rounding, this test should fail.
- The demo must be reachable. There is no retry. A network blip fails the run rather than hiding it.
- Customer data in the test (`Test` / `Buyer` / `12345`) is fake. Nothing is charged. Payment on this site is the fixed label `SauceCard #31337`.
