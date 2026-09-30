import { test } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";
import { InventoryPage } from "../pages/InventoryPage";
import { CartPage } from "../pages/CartPage";
import { CheckoutPage } from "../pages/CheckoutPage";

/**
 * SauceDemo displays item total with the raw sum and rounds tax to cents:
 * tax = (itemTotal * 0.08).toFixed(2)
 * grand = (itemTotal + tax).toFixed(2)
 * Backpack $29.99 + Bike Light $9.99 = $39.98; tax $3.20; total $43.18.
 */
const ITEM_TOTAL = 39.98;
const TAX = (ITEM_TOTAL * 0.08).toFixed(2);
const GRAND = (ITEM_TOTAL + Number(TAX)).toFixed(2);

test("standard user can buy a backpack and a bike light", async ({ page }) => {
  const login = new LoginPage(page);
  const inventory = new InventoryPage(page);
  const cart = new CartPage(page);
  const checkout = new CheckoutPage(page);

  await login.open();
  await login.login("standard_user");
  await inventory.expectLoaded();

  await inventory.add("sauce-labs-backpack");
  await inventory.add("sauce-labs-bike-light");
  await inventory.expectCartCount(2);
  await inventory.openCart();

  await cart.expectItems([
    { name: "Sauce Labs Backpack", price: "$29.99" },
    { name: "Sauce Labs Bike Light", price: "$9.99" },
  ]);
  await cart.checkout();

  await checkout.continue();
  await checkout.expectFirstNameRequired();
  await checkout.fillInformation({
    firstName: "Test",
    lastName: "Buyer",
    postalCode: "12345",
  });

  await checkout.expectOverview({
    subtotal: `Item total: $${ITEM_TOTAL.toFixed(2)}`,
    tax: `Tax: $${TAX}`,
    total: `Total: $${GRAND}`,
  });
  await checkout.finish();
  await checkout.expectCartEmpty();
});
