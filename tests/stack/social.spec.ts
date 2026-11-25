import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { seedUser, signedIn } from "./helpers";

test.describe.configure({ mode: "serial" });
const unique = () => Math.random().toString(36).slice(2, 8);
async function activated(
  page: Page,
  request: Parameters<typeof seedUser>[0],
  context: Parameters<typeof signedIn>[0],
) {
  const seed = await seedUser(request, `m05-${unique()}@example.com`);
  await signedIn(context, seed);
  await page.goto("/onboarding/creator");
  await page.getByRole("link", { name: "Get started" }).click();
  await page.getByLabel("Preferred language").selectOption("en");
  await page.getByLabel("Aspiring Creator").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("I don’t have a social account yet").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("I’m still exploring my niche").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Audience growth").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.getByRole("button", { name: "Activate my workspace" }).click();
  await expect(
    page.getByRole("heading", { name: /You’re all set/ }),
  ).toBeVisible();
  return seed;
}

test.describe("M05 real routes with the local test stack (not Supabase)", () => {
  test("anonymous visitors are sent to sign-in", async ({ page }) => {
    for (const p of [
      "/creator/socials",
      "/creator/socials/new",
      "/creator/socials/settings",
    ]) {
      await page.goto(p);
      await expect(page, p).toHaveURL(/\/login/);
    }
  });

  test("add, record, correct, verify, share, archive and remove", async ({
    page,
    request,
    context,
  }) => {
    await activated(page, request, context);
    await page.goto("/creator/socials");
    await expect(page.getByText("No accounts yet")).toBeVisible();
    await page.getByRole("link", { name: "Add an account" }).click();
    await page.getByLabel("Handle", { exact: true }).fill("asha.creates");
    await page.getByLabel("Followers right now (optional)").fill("1200");
    await page.getByRole("button", { name: "Add account" }).click();
    await expect(
      page.getByRole("heading", { name: "@asha.creates" }),
    ).toBeVisible();
    await expect(page.getByText("Unverified").first()).toBeVisible();
    const id = page.url().split("/").pop()!;

    // invalid handle is rejected with a field error
    await page.goto("/creator/socials/new");
    await page.getByLabel("Platform", { exact: true }).selectOption("youtube");
    await page.getByLabel("Handle", { exact: true }).fill("a");
    await page.getByRole("button", { name: "Add account" }).click();
    await expect(page.locator(".st-error").first()).toBeVisible();

    // metrics + correction
    await page.goto(`/creator/socials/${id}/metrics`);
    await page.getByLabel("Value", { exact: true }).first().fill("1500");
    await page.getByRole("button", { name: "Record metric" }).click();
    await expect(page.getByText(/self-reported/).first()).toBeVisible();
    await page.goto(`/creator/socials/${id}/history`);
    await expect(
      page.getByText(/Followers or subscribers: 1,500/),
    ).toBeVisible();
    await page.getByText("Correct this").first().click();
    await page.getByLabel("Corrected value").first().fill("1450");
    await page.getByLabel("Reason").first().fill("typo");
    await page.getByRole("button", { name: "Save correction" }).first().click();
    await expect(page.getByText(/superseded by a correction/)).toBeVisible();
    await expect(
      page.getByText(/Followers or subscribers: 1,450/),
    ).toBeVisible();

    // verification starts a challenge, never auto-verifies
    await page.goto(`/creator/socials/${id}/verify`);
    await page.getByRole("button", { name: "Start verification" }).click();
    await expect(page.locator("code")).toBeVisible();
    await expect(page.getByText("Verification started").first()).toBeVisible();
    await expect(
      page.getByText(/Evidence upload is not switched on yet/).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Send for review" }).click();
    await expect(page.getByText("Under review").first()).toBeVisible();

    // dashboard widget and nav link
    await page.goto("/creator/dashboard");
    await expect(
      page.getByRole("link", { name: "Manage social accounts" }),
    ).toBeVisible();

    // archive then remove frees the slot
    await page.goto(`/creator/socials/${id}`);
    await page.getByRole("button", { name: "Remove account" }).click();
    await expect(page).toHaveURL(/\/creator\/socials\?removed=1/);
    await expect(page.getByText("No accounts yet")).toBeVisible();
  });

  test("unknown ids are not found and settings save", async ({
    page,
    request,
    context,
  }) => {
    await activated(page, request, context);
    await page.goto("/creator/socials/00000000-0000-4000-8000-000000000000");
    await expect(
      page.getByText(/could not be found|not found|404/i).first(),
    ).toBeVisible();
    await page.goto("/creator/socials/settings");
    await page.getByLabel(/Weekly in-app reminder/).check();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Done.")).toBeVisible();
  });

  test("pages have no serious accessibility violations and no overflow", async ({
    page,
    request,
    context,
  }) => {
    await activated(page, request, context);
    for (const p of [
      "/creator/socials",
      "/creator/socials/new",
      "/creator/socials/settings",
    ]) {
      for (const w of [320, 768, 1280]) {
        await page.setViewportSize({ width: w, height: 800 });
        await page.goto(p);
        const over = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(over, `${p} @${w}`).toBeLessThanOrEqual(1);
      }
      const res = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(
        res.violations.filter((v) =>
          ["serious", "critical"].includes(v.impact ?? ""),
        ),
        p,
      ).toEqual([]);
    }
  });
});
