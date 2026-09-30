const { chromium } = require("playwright");
const path = require("path");
const OUT = path.join(__dirname, "..", "evidence");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("https://www.saucedemo.com/");
  await page.locator('[data-test="username"]').fill("problem_user");
  await page.locator('[data-test="password"]').fill("secret_sauce");
  await page.locator('[data-test="login-button"]').click();
  await page.waitForURL(/inventory/);

  await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
  const removeBackpack = page.locator('[data-test="remove-sauce-labs-backpack"]');
  await removeBackpack.click();
  await page.waitForTimeout(300);
  const backpackAfterRemove = {
    stillRemove: await removeBackpack.count(),
    badge: await page.locator('[data-test="shopping-cart-badge"]').textContent().catch(() => null),
  };

  await page.locator('[data-test="shopping-cart-link"]').click();
  await page.waitForURL(/cart/);
  const cartBefore = await page.locator('[data-test="inventory-item-name"]').allTextContents();
  await page.locator('[data-test="checkout"]').click();
  await page.waitForURL(/checkout-step-one/);

  await page.locator('[data-test="firstName"]').fill("John");
  await page.locator('[data-test="lastName"]').click();
  await page.keyboard.type("Doe", { delay: 80 });
  const fields = {
    first: await page.locator('[data-test="firstName"]').inputValue(),
    last: await page.locator('[data-test="lastName"]').inputValue(),
  };
  await page.locator('[data-test="postalCode"]').fill("54000");
  await page.screenshot({ path: path.join(OUT, "26-problem-checkout-fields.png"), fullPage: true });
  await page.locator('[data-test="continue"]').click();
  await page.waitForTimeout(500);
  const afterContinue = {
    url: page.url(),
    error: await page.locator('[data-test="error"]').textContent().catch(() => null),
    first: await page.locator('[data-test="firstName"]').inputValue().catch(() => null),
    last: await page.locator('[data-test="lastName"]').inputValue().catch(() => null),
  };
  await page.screenshot({ path: path.join(OUT, "27-problem-checkout-blocked.png"), fullPage: true });

  console.log(JSON.stringify({ backpackAfterRemove, cartBefore, fields, afterContinue, errors }, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
