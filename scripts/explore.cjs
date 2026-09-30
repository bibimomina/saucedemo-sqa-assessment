const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = "https://www.saucedemo.com";
const PASSWORD = "secret_sauce";
const OUT = path.join(__dirname, "..", "evidence");
fs.mkdirSync(OUT, { recursive: true });

const findings = [];
function note(id, data) {
  findings.push({ id, ...data });
  console.log("\n== " + id + " ==");
  console.log(JSON.stringify(data, null, 2).slice(0, 4000));
}

async function shot(page, name) {
  const file = path.join(OUT, name + ".png");
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function login(page, user) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.locator('[data-test="username"]').fill(user);
  await page.locator('[data-test="password"]').fill(PASSWORD);
  const start = Date.now();
  await page.locator('[data-test="login-button"]').click();
  await page.waitForURL(/inventory\.html/, { timeout: 20000 }).catch(() => {});
  return Date.now() - start;
}

async function productCards(page) {
  return page.locator('[data-test="inventory-item"]').evaluateAll((cards) =>
    cards.map((card) => {
      const img = card.querySelector("img");
      const name = card.querySelector('[data-test="inventory-item-name"]');
      const price = card.querySelector('[data-test="inventory-item-price"]');
      const button = card.querySelector("button");
      const title = card.querySelector('[data-test$="title-link"]');
      return {
        name: name ? name.textContent.trim() : null,
        price: price ? price.textContent.trim() : null,
        img: img ? img.getAttribute("src") : null,
        alt: img ? img.getAttribute("alt") : null,
        button: button ? button.textContent.trim() : null,
        titleTestId: title ? title.getAttribute("data-test") : null,
        nameAlign: name ? getComputedStyle(name).textAlign : null,
        buttonBox: button ? button.getBoundingClientRect().toJSON() : null,
      };
    }),
  );
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const pageErrors = [];

  async function freshPage() {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    page.on("dialog", async (dialog) => {
      pageErrors.push("DIALOG: " + dialog.message());
      await dialog.accept();
    });
    return { context, page };
  }

  // --- standard_user happy path + money math + empty checkout + logout ---
  {
    const { context, page } = await freshPage();
    const ms = await login(page, "standard_user");
    await page.locator('[data-test="inventory-list"]').waitFor();
    const cards = await productCards(page);
    await shot(page, "01-standard-inventory");
    note("standard-login", { ms, url: page.url(), count: cards.length, cards });

    const names = cards.map((c) => c.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    note("standard-default-sort-az", { names, isAz: JSON.stringify(names) === JSON.stringify(sorted) });

    await page.locator('[data-test="product-sort-container"]').selectOption("za");
    await page.waitForTimeout(300);
    const za = (await productCards(page)).map((c) => c.name);
    const zaExpected = [...names].sort((a, b) => b.localeCompare(a));
    note("standard-sort-za", { za, zaExpected, ok: JSON.stringify(za) === JSON.stringify(zaExpected) });

    await page.locator('[data-test="product-sort-container"]').selectOption("lohi");
    await page.waitForTimeout(300);
    const lohi = (await productCards(page)).map((c) => c.price);
    note("standard-sort-lohi", { lohi });

    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await page.locator('[data-test="add-to-cart-sauce-labs-bike-light"]').click();
    const badge = await page.locator('[data-test="shopping-cart-badge"]').textContent();
    await page.locator('[data-test="shopping-cart-link"]').click();
    await shot(page, "02-standard-cart");
    const cartPrices = await page.locator('[data-test="inventory-item-price"]').allTextContents();
    const cartNames = await page.locator('[data-test="inventory-item-name"]').allTextContents();
    note("standard-cart", { badge, cartNames, cartPrices });

    await page.locator('[data-test="checkout"]').click();
    await page.locator('[data-test="continue"]').click();
    const requiredError = await page.locator('[data-test="error"]').textContent().catch(() => null);
    await shot(page, "03-standard-checkout-validation");
    note("standard-empty-info", { requiredError });

    await page.locator('[data-test="firstName"]').fill("Momina");
    await page.locator('[data-test="lastName"]').fill("Khan");
    await page.locator('[data-test="postalCode"]').fill("54000");
    const fieldValues = {
      first: await page.locator('[data-test="firstName"]').inputValue(),
      last: await page.locator('[data-test="lastName"]').inputValue(),
      postal: await page.locator('[data-test="postalCode"]').inputValue(),
    };
    await page.locator('[data-test="continue"]').click();
    await page.locator('[data-test="total-label"]').waitFor();
    const summary = {
      subtotal: await page.locator('[data-test="subtotal-label"]').textContent(),
      tax: await page.locator('[data-test="tax-label"]').textContent(),
      total: await page.locator('[data-test="total-label"]').textContent(),
      payment: await page.locator('[data-test="payment-info-value"]').textContent(),
    };
    await shot(page, "04-standard-overview");
    note("standard-overview", { fieldValues, summary });

    await page.locator('[data-test="finish"]').click();
    await page.locator('[data-test="complete-header"]').waitFor();
    const complete = await page.locator('[data-test="complete-header"]').textContent();
    await shot(page, "05-standard-complete");
    await page.locator('[data-test="shopping-cart-link"]').click();
    const cartAfter = await page.locator('[data-test="inventory-item-name"]').count();
    note("standard-complete", { complete, cartAfter, url: page.url() });

    await context.close();
  }

  // empty cart checkout
  {
    const { context, page } = await freshPage();
    await login(page, "standard_user");
    await page.locator('[data-test="shopping-cart-link"]').click();
    await page.locator('[data-test="checkout"]').click();
    const onInfo = page.url();
    await page.locator('[data-test="firstName"]').fill("Empty");
    await page.locator('[data-test="lastName"]').fill("Cart");
    await page.locator('[data-test="postalCode"]').fill("00000");
    await page.locator('[data-test="continue"]').click();
    const summary = page.url().includes("step-two")
      ? {
          subtotal: await page.locator('[data-test="subtotal-label"]').textContent(),
          tax: await page.locator('[data-test="tax-label"]').textContent(),
          total: await page.locator('[data-test="total-label"]').textContent(),
          items: await page.locator('[data-test="inventory-item-name"]').count(),
        }
      : null;
    if (summary) await shot(page, "06-empty-cart-overview");
    let finished = null;
    if (summary) {
      await page.locator('[data-test="finish"]').click();
      finished = await page.locator('[data-test="complete-header"]').textContent().catch(() => null);
      await shot(page, "07-empty-cart-complete");
    }
    note("empty-cart-checkout", { onInfo, summary, finished, url: page.url() });
    await context.close();
  }

  // cross-account cart
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await login(page, "standard_user");
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await page.locator("#react-burger-menu-btn").click();
    await page.locator("#logout_sidebar_link").click();
    await page.waitForURL(BASE + "/");
    const storageAfterLogout = await page.evaluate(() => ({
      cart: localStorage.getItem("cart-contents"),
      cookies: document.cookie,
    }));
    await login(page, "visual_user");
    const badge = await page.locator('[data-test="shopping-cart-badge"]').textContent().catch(() => null);
    await page.locator('[data-test="shopping-cart-link"]').click();
    const names = await page.locator('[data-test="inventory-item-name"]').allTextContents();
    await shot(page, "08-cross-user-cart");
    note("cross-user-cart", { storageAfterLogout, badge, names });
    await context.close();
  }

  // logout then back / direct url
  {
    const { context, page } = await freshPage();
    await login(page, "standard_user");
    await page.locator("#react-burger-menu-btn").click();
    await page.locator("#logout_sidebar_link").click();
    await page.waitForURL(/saucedemo\.com\/?$/);
    await page.goBack();
    await page.waitForTimeout(500);
    const afterBack = {
      url: page.url(),
      inventoryVisible: await page.locator('[data-test="inventory-list"]').count(),
      loginVisible: await page.locator('[data-test="login-button"]').count(),
    };
    await shot(page, "09-after-back");
    await page.goto(BASE + "/inventory.html");
    await page.waitForTimeout(500);
    const direct = {
      url: page.url(),
      error: await page.locator('[data-test="error"]').textContent().catch(() => null),
      inventoryVisible: await page.locator('[data-test="inventory-list"]').count(),
    };
    await shot(page, "10-direct-inventory-logged-out");
    note("session-after-logout", { afterBack, direct });
    await context.close();
  }

  // problem_user
  {
    const { context, page } = await freshPage();
    await login(page, "problem_user");
    await page.locator('[data-test="inventory-list"]').waitFor();
    const cards = await productCards(page);
    await shot(page, "11-problem-inventory");
    note("problem-inventory", {
      images: cards.map((c) => ({ name: c.name, img: c.img })),
      uniqueImages: [...new Set(cards.map((c) => c.img))],
    });

    const beforeSort = cards.map((c) => c.name);
    await page.locator('[data-test="product-sort-container"]').selectOption("za");
    await page.waitForTimeout(300);
    const afterSort = (await productCards(page)).map((c) => c.name);
    note("problem-sort", { beforeSort, afterSort, changed: JSON.stringify(beforeSort) !== JSON.stringify(afterSort) });

    const addResults = [];
    for (const card of cards) {
      const slug = card.name.replace(/\s+/g, "-").toLowerCase();
      const addBtn = page.locator(`[data-test="add-to-cart-${slug}"]`);
      const exists = await addBtn.count();
      if (!exists) {
        addResults.push({ name: card.name, result: "no-add-button", button: card.button });
        continue;
      }
      const errorsBefore = pageErrors.length;
      await addBtn.click().catch((e) => addResults.push({ name: card.name, clickError: String(e) }));
      await page.waitForTimeout(200);
      const badge = await page.locator('[data-test="shopping-cart-badge"]').textContent().catch(() => null);
      const stillAdd = await addBtn.count();
      addResults.push({
        name: card.name,
        badge,
        stillShowsAdd: stillAdd > 0,
        newErrors: pageErrors.slice(errorsBefore),
      });
    }
    await shot(page, "12-problem-after-adds");
    await page.locator('[data-test="shopping-cart-link"]').click();
    const cartNames = await page.locator('[data-test="inventory-item-name"]').allTextContents();
    await shot(page, "13-problem-cart");
    note("problem-add", { addResults, cartNames });

    // open each title and record destination name
    await page.goto(BASE + "/inventory.html");
    const linkResults = [];
    const ids = await page.locator('[data-test$="title-link"]').evaluateAll((els) =>
      els.map((el) => ({
        testId: el.getAttribute("data-test"),
        name: el.textContent.trim(),
      })),
    );
    for (const item of ids) {
      await page.locator(`[data-test="${item.testId}"]`).click();
      await page.waitForTimeout(300);
      const detailName = await page.locator(".inventory_details_name").textContent().catch(() => null);
      const detailPrice = await page.locator(".inventory_details_price").textContent().catch(() => null);
      const detailImg = await page.locator(".inventory_details_img").getAttribute("src").catch(() => null);
      linkResults.push({ from: item.name, url: page.url(), detailName, detailPrice, detailImg });
      if (item.name.includes("Fleece") || item.name.includes("Backpack")) {
        await shot(page, "14-problem-detail-" + item.name.split(" ").pop());
      }
      await page.goto(BASE + "/inventory.html");
    }
    note("problem-links", { linkResults });

    // checkout field corruption — only if something is in the cart
    await page.goto(BASE + "/inventory.html");
    // add onesie (even id) if possible
    const onesie = page.locator('[data-test="add-to-cart-sauce-labs-onesie"]');
    if (await onesie.count()) await onesie.click();
    await page.locator('[data-test="shopping-cart-link"]').click();
    if (await page.locator('[data-test="checkout"]').count()) {
      await page.locator('[data-test="checkout"]').click();
      await page.locator('[data-test="firstName"]').fill("John");
      const afterFirst = await page.locator('[data-test="firstName"]').inputValue();
      await page.locator('[data-test="lastName"]').pressSequentially("Doe", { delay: 50 });
      const afterLast = {
        first: await page.locator('[data-test="firstName"]').inputValue(),
        last: await page.locator('[data-test="lastName"]').inputValue(),
      };
      await page.locator('[data-test="postalCode"]').fill("54000");
      await shot(page, "15-problem-checkout-fields");
      await page.locator('[data-test="continue"]').click();
      await page.waitForTimeout(400);
      const error = await page.locator('[data-test="error"]').textContent().catch(() => null);
      note("problem-checkout", { afterFirst, afterLast, error, url: page.url() });
      await shot(page, "16-problem-checkout-result");
    }
    await context.close();
  }

  // error_user
  {
    pageErrors.length = 0;
    const { context, page } = await freshPage();
    await login(page, "error_user");
    await page.locator('[data-test="inventory-list"]').waitFor();
    await shot(page, "17-error-inventory");
    const errorsBeforeSort = pageErrors.length;
    await page.locator('[data-test="product-sort-container"]').selectOption("lohi");
    await page.waitForTimeout(400);
    const namesAfter = (await productCards(page)).map((c) => c.name);
    note("error-sort", { namesAfter, dialogsOrErrors: pageErrors.slice(errorsBeforeSort) });

    const addResults = [];
    const cards = await productCards(page);
    for (const card of cards) {
      const slug = card.name.replace(/\s+/g, "-").toLowerCase();
      const addBtn = page.locator(`[data-test="add-to-cart-${slug}"]`);
      if (!(await addBtn.count())) continue;
      const before = pageErrors.length;
      await addBtn.click().catch((e) => addResults.push({ name: card.name, clickError: String(e) }));
      await page.waitForTimeout(250);
      addResults.push({
        name: card.name,
        badge: await page.locator('[data-test="shopping-cart-badge"]').textContent().catch(() => null),
        stillAdd: (await addBtn.count()) > 0,
        errors: pageErrors.slice(before),
      });
    }
    await shot(page, "18-error-after-adds");
    await page.locator('[data-test="shopping-cart-link"]').click();
    const cartNames = await page.locator('[data-test="inventory-item-name"]').allTextContents();
    note("error-add", { addResults, cartNames, pageErrors });

    if (cartNames.length) {
      await page.locator('[data-test="checkout"]').click();
      await page.locator('[data-test="firstName"]').fill("Err");
      const beforeLast = pageErrors.length;
      await page.locator('[data-test="lastName"]').pressSequentially("User", { delay: 30 }).catch((e) => {
        pageErrors.push("lastName type: " + e);
      });
      const fields = {
        first: await page.locator('[data-test="firstName"]').inputValue().catch(() => null),
        last: await page.locator('[data-test="lastName"]').inputValue().catch(() => null),
      };
      await page.locator('[data-test="postalCode"]').fill("1").catch(() => {});
      await shot(page, "19-error-checkout-info");
      await page.locator('[data-test="continue"]').click().catch((e) => pageErrors.push(String(e)));
      await page.waitForTimeout(500);
      const stepUrl = page.url();
      let finishResult = { stepUrl };
      if (stepUrl.includes("step-two")) {
        await shot(page, "20-error-overview");
        finishResult.summary = await page.locator('[data-test="total-label"]').textContent().catch(() => null);
        const beforeFinish = pageErrors.length;
        await page.locator('[data-test="finish"]').click().catch((e) => pageErrors.push(String(e)));
        await page.waitForTimeout(800);
        finishResult.complete = await page.locator('[data-test="complete-header"]').textContent().catch(() => null);
        finishResult.errors = pageErrors.slice(beforeFinish);
        finishResult.url = page.url();
        await shot(page, "21-error-finish");
      }
      note("error-checkout", { fields, lastNameErrors: pageErrors.slice(beforeLast), finishResult });
    }
    await context.close();
  }

  // visual_user prices
  {
    const { context, page } = await freshPage();
    await login(page, "visual_user");
    await page.locator('[data-test="inventory-list"]').waitFor();
    const first = await productCards(page);
    await shot(page, "22-visual-inventory");
    await page.reload();
    await page.locator('[data-test="inventory-list"]').waitFor();
    const second = await productCards(page);
    note("visual-prices", {
      first: first.map((c) => ({ name: c.name, price: c.price, img: c.img, align: c.nameAlign })),
      second: second.map((c) => ({ name: c.name, price: c.price, img: c.img })),
      pricesChanged: first.map((c) => c.price).join() !== second.map((c) => c.price).join(),
    });
    const backpackPrice = first.find((c) => c.name.includes("Backpack")).price;
    const add = page.locator('[data-test="add-to-cart-sauce-labs-backpack"]');
    if (await add.count()) await add.click();
    await page.locator('[data-test="shopping-cart-link"]').click();
    await shot(page, "23-visual-cart");
    const cartPrice = await page.locator('[data-test="inventory-item-price"]').first().textContent();
    const checkoutClass = await page.locator('[data-test="checkout"]').getAttribute("class");
    const checkoutBox = await page.locator('[data-test="checkout"]').boundingBox();
    note("visual-cart-price", { catalogPrice: backpackPrice, cartPrice, checkoutClass, checkoutBox });
    await context.close();
  }

  // performance
  {
    const { context, page } = await freshPage();
    const ms = await login(page, "performance_glitch_user");
    const inventoryShown = await page.locator('[data-test="inventory-list"]').count();
    note("performance", { ms, url: page.url(), inventoryShown });
    await shot(page, "24-performance-inventory");
    await context.close();
  }

  // locked out
  {
    const { context, page } = await freshPage();
    await page.goto(BASE);
    await page.locator('[data-test="username"]').fill("locked_out_user");
    await page.locator('[data-test="password"]').fill(PASSWORD);
    await page.locator('[data-test="login-button"]').click();
    await page.waitForTimeout(400);
    const error = await page.locator('[data-test="error"]').textContent().catch(() => null);
    await shot(page, "25-locked-out");
    note("locked-out", { error, url: page.url() });
    await context.close();
  }

  fs.writeFileSync(path.join(OUT, "findings.json"), JSON.stringify({ findings, pageErrors }, null, 2));
  await browser.close();
  console.log("\nWROTE findings.json");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
