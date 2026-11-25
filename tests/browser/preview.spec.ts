import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.beforeEach(async ({ page }) => {
  await page.goto("/dev/design-system");
  await expect(
    page.getByRole("heading", { name: "Design system", exact: true }),
  ).toBeVisible();
});
for (const width of [360, 768, 1440]) {
  test("accessible layout at " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
test("validate and apply a specimen", async ({ page }) => {
  await page.getByRole("button", { name: "Apply specimen" }).click();
  await expect(page.getByLabel("Type specimen", { exact: true })).toBeFocused();
  await expect(
    page.getByRole("alert").filter({ hasText: "Enter a specimen name." }),
  ).toBeVisible();
  await page.getByLabel("Type specimen", { exact: true }).fill("Studio");
  await page.getByRole("button", { name: "Apply specimen" }).click();
  await expect(page.locator(".specimen span")).toHaveText("Studio");
  await expect(
    page.getByText("Preview notification", { exact: true }).first(),
  ).toBeVisible();
});
test("dialog restores keyboard focus", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Open dialog" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});
test("menu, options and feedback states", async ({ page }) => {
  await page.getByLabel("Enable option").check();
  await page.getByRole("radio", { name: "comfortable" }).check();
  await page.getByRole("combobox").selectOption("Regular");
  await page.getByRole("button", { name: "Sample text" }).click();
  await page.getByRole("menuitem", { name: "AURA" }).click();
  await expect(page.locator(".specimen span")).toHaveText("AURA");
  await page.getByRole("tab", { name: "Loading" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Loading specimen");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tabpanel")).toContainText("Example error");
});
