import { expect, type Page } from "@playwright/test";

export class LoginPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto("/");
    await expect(this.page.getByTestId("login-button")).toBeVisible();
  }

  async login(username: string, password = "secret_sauce") {
    await this.page.getByTestId("username").fill(username);
    await this.page.getByTestId("password").fill(password);
    await this.page.getByTestId("login-button").click();
    await expect(this.page).toHaveURL(/\/inventory\.html$/);
  }
}
