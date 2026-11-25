import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const steps = [
  "identity",
  "social",
  "niche",
  "goals",
  "challenges",
  "preferences",
  "rates",
  "resources",
  "summary",
];
const widths = [320, 360, 390, 430, 768, 1024, 1440, 1920];
const url = (s: string) => `/dev/onboarding-preview/${s}`;

test.describe("M03 access control (real routes)", () => {
  test("anonymous visitors cannot reach Creator onboarding", async ({
    page,
  }) => {
    for (const path of [
      "/onboarding/creator",
      "/onboarding/creator/identity",
      "/onboarding/creator/complete",
      "/onboarding/creator/profile",
      "/onboarding/creator/review",
    ]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/login/);
    }
  });
  test("an unknown step is not served to anonymous visitors", async ({
    page,
  }) => {
    await page.goto("/onboarding/creator/not-a-step");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("M03 step behaviour (development preview, same components and validators)", () => {
  test("identity validates inline with accessible errors, then continues", async ({
    page,
  }) => {
    await page.goto(url("identity"));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("alert").first()).toContainText(
      "Please fix the highlighted fields",
    );
    await expect(page.getByLabel("Creator name")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await page.getByLabel("Creator name").fill("Asha");
    await page.getByLabel("Country").selectOption("IN");
    await page.getByLabel("Preferred language").selectOption("en");
    await page.getByLabel("Aspiring Creator").check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/social$/);
  });
  test("a creator with no social account can proceed; account entry rules hold", async ({
    page,
  }) => {
    await page.goto(url("social"));
    await page.getByLabel("I don’t have a social account yet").check();
    await expect(
      page.getByRole("button", { name: "Add an account" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/niche$/);
    await page.goto(url("social"));
    await page.getByRole("button", { name: "Add an account" }).click();
    await expect(
      page.getByText("Everything here is self-reported and unverified"),
    ).toBeVisible();
    await expect(page.getByLabel("Instagram account type")).toBeVisible();
    await page.getByLabel("Platform").selectOption("youtube");
    await expect(page.getByLabel("Instagram account type")).toHaveCount(0);
    await page.getByLabel("Username").fill("asha");
    await page.getByLabel(/Profile link/).fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByText(/Use a link that starts with https/).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/screenshot upload is unavailable/i),
    ).toBeVisible();
  });
  test("enforces the ten account limit", async ({ page }) => {
    await page.goto(url("social"));
    for (let i = 0; i < 10; i++)
      await page.getByRole("button", { name: "Add an account" }).click();
    await expect(
      page.getByRole("button", { name: "Add an account" }),
    ).toBeDisabled();
    await expect(page.getByText("10 of 10")).toBeVisible();
  });
  test("niche: exploring is valid, and selection works by keyboard", async ({
    page,
  }) => {
    await page.goto(url("niche"));
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByText(/Choose a primary niche/).first(),
    ).toBeVisible();
    await page.getByLabel("I’m still exploring my niche").check();
    await expect(
      page.getByRole("group", { name: "Primary niche", exact: true }),
    ).toHaveCount(0);
    await page.getByLabel("I’m still exploring my niche").uncheck();
    await page.getByLabel("Search primary niche").fill("food");
    const food = page.getByRole("radio", { name: /^Food/ });
    await food.focus();
    await page.keyboard.press("Space");
    await expect(food).toBeChecked();
  });
  test("goals: numeric targets can be deferred", async ({ page }) => {
    await page.goto(url("goals"));
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByText(/Choose at least one goal/).first(),
    ).toBeVisible();
    await page.getByLabel("Audience growth").check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/challenges$/);
  });
  test("optional steps can be skipped", async ({ page }) => {
    await page.goto(url("challenges"));
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page).toHaveURL(/\/preferences$/);
  });
  test("an excluded industry cannot also be chosen as a preference", async ({
    page,
  }) => {
    await page.goto(url("preferences"));
    const excl = page.getByRole("group", {
      name: "Industries you will not work with",
    });
    await excl.getByRole("checkbox", { name: /^Alcohol/ }).check();
    const pref = page.getByRole("group", {
      name: "Industries you would love to work with",
    });
    await expect(pref.getByRole("checkbox", { name: /^Alcohol/ })).toHaveCount(
      0,
    );
  });
  test("rates are optional and unsure rates hide the amount", async ({
    page,
  }) => {
    await page.goto(url("rates"));
    await page.getByRole("checkbox", { name: "Short-form video" }).check();
    await page.getByLabel("I’m not sure what to charge").check();
    await expect(page.getByLabel(/Rate for short-form video/)).toHaveCount(0);
  });
  test("no private questionnaire output or guarantees appear in the summary preview", async ({
    page,
  }) => {
    await page.goto(url("summary"));
    await expect(
      page.getByText("No published opportunities yet."),
    ).toBeVisible();
    await expect(page.getByText(/not AI-generated/)).toBeVisible();
    await expect(page.getByText(/Private/).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      /guaranteed|you will earn/i,
    );
  });
});

async function overflow(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
}
test.describe("M03 responsive layout", () => {
  for (const width of widths)
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const s of steps) {
        await page.goto(url(s));
        await expect(page.getByRole("main")).toBeVisible();
        expect(await overflow(page), `${s} at ${width}`).toBeLessThanOrEqual(0);
      }
    });
});
test.describe("M03 accessibility (axe, WCAG 2 A/AA)", () => {
  for (const s of steps)
    test(`no axe violations on ${s}`, async ({ page }) => {
      await page.goto(url(s));
      const r = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        r.violations.map(
          (v) =>
            `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
        ),
      ).toEqual([]);
    });
});
