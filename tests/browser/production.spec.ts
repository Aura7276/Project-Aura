import { test, expect } from "@playwright/test";
test("production denies the preview", async ({ request }) => {
  const response = await request.get("/dev/design-system");
  expect(response.status()).toBe(404);
  expect(await response.text()).not.toContain("Apply specimen");
});
test("serves foundation with a fresh nonce and defensive headers", async ({
  page,
  request,
}) => {
  const response = await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Your creativity deserves more.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Open design system")).toHaveCount(0);
  const headers = response!.headers();
  expect(headers["content-security-policy"]).toMatch(/'nonce-[^']+'/);
  expect(headers["content-security-policy"]).not.toContain("unsafe-eval");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(
    (await request.get("/")).headers()["content-security-policy"],
  ).not.toBe(headers["content-security-policy"]);
});

test("production hides readiness routes and links", async ({
  request,
  page,
}) => {
  expect((await request.get("/readiness/privacy")).status()).toBe(404);
  await page.goto("/");
  await expect(page.locator("a[href^='/readiness/']")).toHaveCount(0);
});

test("production Creator entry and pending registration", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "I’m a Creator" }).first().click();
  await expect(page).toHaveURL(/\/creators$/);
  await expect(
    page.getByText("Creator registration · Coming soon").first(),
  ).toBeVisible();
});

test("both homepage Brand entries resolve and registration stays pending", async ({
  page,
}) => {
  await page.goto("/");
  const links = page.getByRole("link", { name: "I’m a Brand" });
  await expect(links).toHaveCount(2);
  for (const link of await links.all())
    await expect(link).toHaveAttribute("href", "/brands");
  await links.last().click();
  await expect(page).toHaveURL(/\/brands$/);
  await expect(
    page.getByText("Brand registration · Coming soon").first(),
  ).toBeVisible();
});

test("public directory destinations work in production", async ({
  page,
  request,
}) => {
  await page.goto("/agencies");
  const footer = page.getByRole("navigation", { name: "Footer" });
  for (const [label, path] of [
    ["For Agencies", "/agencies"],
    ["Discover creators", "/explore/creators"],
    ["Support centre", "/support"],
  ])
    await expect(footer.getByRole("link", { name: label })).toHaveAttribute(
      "href",
      path,
    );
  for (const path of [
    "/demo",
    "/resources",
    "/faq",
    "/privacy",
    "/terms",
    "/contact",
    "/pricing",
    "/about",
    "/features",
  ]) {
    expect((await request.get(path)).status()).toBe(200);
  }
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Free to get started",
  );
});
