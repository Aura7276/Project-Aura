import { test, expect } from "@playwright/test";
test("registration offers email, age confirmation and Google", async ({
  page,
}) => {
  await page.goto("/register");
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveAttribute("required", "");
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
});
test("anonymous workspace access returns to login", async ({ page }) => {
  await page.goto("/workspaces");
  await expect(page).toHaveURL(/\/login\?/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});
