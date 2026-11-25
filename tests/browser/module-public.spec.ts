import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("complete Creator and Brand walkthroughs", async ({ page }) => {
  await page.goto("/demo");
  for (const [role, count] of [
    ["Creator", 8],
    ["Brand", 7],
  ] as const) {
    await page.getByRole("radio", { name: role }).check();
    for (let i = 1; i < count; i++)
      await page.getByRole("button", { name: "Next step" }).click();
    await expect(page.locator("main [aria-live]")).toContainText(
      count + " of " + count,
    );
    await page.getByRole("button", { name: "Restart journey" }).click();
    await expect(page.getByRole("button", { name: "Previous" })).toBeDisabled();
  }
  await page.getByRole("combobox").selectOption("2");
  await expect(page.locator("main [aria-live]")).toContainText(
    "Creator discovery",
  );
});
test("browse resources and prepare a private enquiry", async ({ page }) => {
  await page.goto("/resources");
  await page.getByRole("link", { name: /Test two openings/ }).click();
  await expect(
    page.getByRole("heading", { name: "Record comparable observations" }),
  ).toBeVisible();
  await page.goto("/contact");
  await page.getByLabel("Your message").fill("How can I prepare my portfolio?");
  await page.getByRole("button", { name: "Prepare enquiry" }).click();
  await expect(
    page.getByRole("heading", { name: "Enquiry draft" }),
  ).toBeVisible();
});
test("discovery and invite boundaries", async ({ page, request }) => {
  for (const path of [
    "/creator/nonexistent-test-fixture",
    "/campaign/nonexistent-test-fixture",
    "/resources/unlisted-test-fixture",
  ]) {
    expect((await request.get(path)).status()).toBe(404);
  }
  await page.goto("/explore/campaigns");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Discover campaigns",
  );
  await page.goto("/invite/fixture");
  await page.getByRole("link", { name: /View registration readiness/ }).click();
  await page.getByRole("link", { name: "Return to the invitation" }).click();
  await expect(
    page.getByText(/Attribution has not been recorded/),
  ).toBeVisible();
});
for (const path of ["/agencies", "/demo", "/contact", "/resources", "/pricing"])
  test(
    path + " fits mobile and passes accessibility scan",
    async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 850 });
      await page.goto(path);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    },
  );
