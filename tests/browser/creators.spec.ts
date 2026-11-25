import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const width of [320, 360, 390, 430, 768, 1024, 1440, 1920])
  test("creator page at " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/creators");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "We help you",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("link", { name: "Creator registration" }).first(),
    ).toHaveAttribute("href", "/register");
    if ([390, 768, 1440].includes(width)) {
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: "docs/development/evidence/m01-creators-" + width + ".png",
        fullPage: true,
      });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
  });
test("keyboard preview and eligibility", async ({ page }) => {
  await page.goto("/creators");
  await page.getByRole("tab", { name: "Growth" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tabpanel")).toContainText(
    "experiment worksheet",
  );
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tabpanel")).toContainText("weekly planner");
  await page
    .locator("summary")
    .filter({ hasText: "What is the 100-follower" })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("details[open]")).toContainText(
    "one applicable account",
  );
});
