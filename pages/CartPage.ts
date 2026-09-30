import { expect, type Page } from "@playwright/test";

export class CartPage {
  constructor(private readonly page: Page) {}

  async expectItems(items: { name: string; price: string }[]) {
    await expect(this.page.getByTestId("inventory-item")).toHaveCount(
      items.length,
    );
    for (const item of items) {
      const row = this.page
        .getByTestId("inventory-item")
        .filter({ hasText: item.name });
      await expect(row.getByTestId("inventory-item-name")).toHaveText(item.name);
      await expect(row.getByTestId("inventory-item-price")).toHaveText(
        item.price,
      );
      await expect(row.getByTestId("item-quantity")).toHaveText("1");
    }
  }

  async checkout() {
    await this.page.getByTestId("checkout").click();
    await expect(this.page).toHaveURL(/\/checkout-step-one\.html$/);
  }
}
