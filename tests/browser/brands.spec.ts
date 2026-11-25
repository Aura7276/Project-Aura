import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const width of [320, 360, 390, 430, 768, 1024, 1440, 1920])
  test("Brand page at " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/brands");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Grow your brand",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("link", { name: /Brand registration/ }).first(),
    ).toHaveAttribute("href", "/readiness/register");
    if ([390, 768, 1440].includes(width)) {
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: "docs/development/evidence/m01-brands-" + width + ".png",
        fullPage: true,
      });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
  });
test("Brand studio and verification FAQ", async ({ page }) => {
  await page.goto("/brands");
  await page
    .locator("summary")
    .filter({ hasText: "Creator discovery" })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Sample search criteria")).toBeVisible();
  await expect(page.getByText("Example brief", { exact: true })).toBeHidden();
  await page
    .getByText("When is business verification required?", { exact: true })
    .click();
  await expect(page.getByText(/Unverified businesses may use/)).toBeVisible();
});
