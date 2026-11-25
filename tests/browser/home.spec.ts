import { test, expect } from "@playwright/test";
test("homepage journeys, keyboard preview and questions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "I’m a Creator" }).first(),
  ).toHaveAttribute("href", "/creators");
  await expect(
    page.getByRole("link", { name: "I’m a Brand" }).first(),
  ).toHaveAttribute("href", "/brands");
  await page.getByRole("tab", { name: "Creator", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tabpanel")).toContainText("Marketing brief");
  const question = page
    .locator("summary")
    .filter({ hasText: "Can beginners join?" });
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(/Yes. The planned Creator journey/),
  ).toBeVisible();
  expect(
    await page
      .locator("main img")
      .evaluate((node) => (node as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
});
