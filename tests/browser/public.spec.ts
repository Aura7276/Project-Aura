import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const width of [320, 360, 390, 430, 768, 1024, 1440])
  test("shell at " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("navigation", { name: "Footer" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 1440) {
      const trigger = page.getByRole("button", {
        name: "Explore",
        exact: true,
      });
      await trigger.focus();
      await page.keyboard.press("ArrowDown");
      await expect(page.getByRole("menuitem").first()).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
      await trigger.click();
      await page.getByRole("heading", { level: 1 }).click();
      await expect(page.getByRole("menu")).toHaveCount(0);
    } else {
      const trigger = page.getByRole("button", {
        name: "Open navigation menu",
      });
      await trigger.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
    }
    if ([1440, 768, 390].includes(width)) {
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: "docs/development/evidence/m01-home-" + width + ".png",
        fullPage: true,
      });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
  });
test("readiness destinations and preview layout isolation", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Footer" })
    .getByText("Privacy", { exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();
  await expect(page.getByText(/awaiting approval/)).toBeVisible();
  await page.goto("/dev/design-system");
  await expect(page.getByRole("navigation", { name: "Footer" })).toHaveCount(0);
});
