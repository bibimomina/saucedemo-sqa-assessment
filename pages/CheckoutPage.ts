import { expect, type Page } from "@playwright/test";

export class CheckoutPage {
  constructor(private readonly page: Page) {}

  async continue() {
    await this.page.getByTestId("continue").click();
  }

  async expectFirstNameRequired() {
    await expect(this.page.getByTestId("error")).toHaveText(
      "Error: First Name is required",
    );
    await expect(this.page).toHaveURL(/\/checkout-step-one\.html$/);
  }

  async fillInformation(info: {
    firstName: string;
    lastName: string;
    postalCode: string;
  }) {
    await this.page.getByTestId("firstName").fill(info.firstName);
    await this.page.getByTestId("lastName").fill(info.lastName);
    await this.page.getByTestId("postalCode").fill(info.postalCode);
    await this.continue();
    await expect(this.page).toHaveURL(/\/checkout-step-two\.html$/);
  }

  async expectOverview(expected: {
    subtotal: string;
    tax: string;
    total: string;
  }) {
    await expect(this.page.getByTestId("payment-info-value")).toHaveText(
      "SauceCard #31337",
    );
    await expect(this.page.getByTestId("subtotal-label")).toHaveText(
      expected.subtotal,
    );
    await expect(this.page.getByTestId("tax-label")).toHaveText(expected.tax);
    await expect(this.page.getByTestId("total-label")).toHaveText(expected.total);
  }

  async finish() {
    await this.page.getByTestId("finish").click();
    await expect(this.page).toHaveURL(/\/checkout-complete\.html$/);
    await expect(this.page.getByTestId("complete-header")).toHaveText(
      "Thank you for your order!",
    );
  }

  async expectCartEmpty() {
    await this.page.getByTestId("shopping-cart-link").click();
    await expect(this.page).toHaveURL(/\/cart\.html$/);
    await expect(this.page.getByTestId("shopping-cart-badge")).toHaveCount(0);
    await expect(this.page.getByTestId("inventory-item")).toHaveCount(0);
  }
}
