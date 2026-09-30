import { expect, type Page } from "@playwright/test";

export class InventoryPage {
  constructor(private readonly page: Page) {}

  async expectLoaded() {
    await expect(this.page.getByTestId("inventory-list")).toBeVisible();
    await expect(this.page.getByTestId("inventory-item")).toHaveCount(6);
  }

  async add(productSlug: string) {
    await this.page.getByTestId(`add-to-cart-${productSlug}`).click();
    await expect(this.page.getByTestId(`remove-${productSlug}`)).toBeVisible();
  }

  async expectCartCount(count: number) {
    await expect(this.page.getByTestId("shopping-cart-badge")).toHaveText(
      String(count),
    );
  }

  async openCart() {
    await this.page.getByTestId("shopping-cart-link").click();
    await expect(this.page).toHaveURL(/\/cart\.html$/);
  }
}
