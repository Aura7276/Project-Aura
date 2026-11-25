import { expect, test, type Page } from "@playwright/test";
import { seedUser, signedIn } from "./helpers";

test.describe.configure({ mode: "serial" });
async function activate(page: Page) {
  await page.getByRole("button", { name: "Activate my workspace" }).click();
  await expect(
    page.getByRole("heading", { name: /You’re all set/ }),
  ).toBeVisible(); // wait for the real activation to finish
}
const unique = () => Math.random().toString(36).slice(2, 8);

async function completeOnboarding(page: Page) {
  await page.goto("/onboarding/creator");
  await page.getByRole("link", { name: "Get started" }).click();
  await expect(page.getByLabel("Creator name")).toHaveValue("Asha Rao"); // reused from the M02 identity metadata
  await expect(page.getByLabel("Country")).toHaveValue("IN");
  await page.getByLabel("Preferred language").selectOption("en");
  await page.getByLabel("Aspiring Creator").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("I don’t have a social account yet").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("I’m still exploring my niche").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Audience growth").check();
  await page.getByText("Audience growth: add a target (optional)").click();
  await page.getByLabel("Your target").fill("500");
  await page.getByLabel("Days to reach it").fill("90");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click(); // challenges
  await page.getByRole("button", { name: "Skip for now" }).click(); // preferences
  await expect(
    page.getByRole("heading", { name: "Review your answers" }),
  ).toBeVisible();
}

test.describe("Real routes with the local test stack (not Supabase)", () => {
  test("anonymous visitors are sent to sign-in", async ({ page }) => {
    for (const p of [
      "/creator/dashboard",
      "/onboarding/creator",
      "/creator/actions",
    ]) {
      await page.goto(p);
      await expect(page, p).toHaveURL(/\/login/);
    }
  });

  test("a Brand workspace owner cannot reach Creator Studio", async ({
    page,
    context,
    request,
  }) => {
    await signedIn(
      context,
      await seedUser(
        request,
        `brand-${unique()}@example.test`,
        "Brand Owner",
        "brand",
      ),
    );
    await page.goto("/creator/dashboard");
    await expect(page).toHaveURL(/\/(mfa|workspaces)/); // M02 sends Brand owners to MFA first; either way never into Creator Studio
    await expect(
      page.getByRole("heading", { name: "Today’s actions" }),
    ).toHaveCount(0);
    await page.goto("/onboarding/creator");
    await expect(page).toHaveURL(/\/(mfa|workspaces)/);
  });

  test("incomplete onboarding is redirected to the real M03 continuation", async ({
    page,
    context,
    request,
  }) => {
    await signedIn(
      context,
      await seedUser(request, `new-${unique()}@example.test`),
    );
    for (const p of [
      "/creator/dashboard",
      "/creator/actions",
      "/creator/search?q=hello",
    ]) {
      await page.goto(p);
      await expect(page, p).toHaveURL(/\/onboarding\/creator$/);
    }
  });

  test("save and exit, then resume at the right step (M03)", async ({
    page,
    context,
    request,
  }) => {
    await signedIn(
      context,
      await seedUser(request, `resume-${unique()}@example.test`),
    );
    await page.goto("/onboarding/creator");
    await page.getByRole("link", { name: "Get started" }).click();
    await page.getByLabel("Preferred language").selectOption("hi");
    await page.getByLabel("Growing Creator").check();
    await page.getByRole("button", { name: "Save and exit" }).click();
    await expect(page).toHaveURL(/\/workspaces/);
    await page.goto("/onboarding/creator");
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/onboarding\/creator\/social$/); // identity was saved, so we resume after it
    await page.goto("/onboarding/creator/identity");
    await expect(page.getByLabel("Preferred language")).toHaveValue("hi");
  });

  test("an aspiring Creator with no social account completes onboarding and reaches a real, honest dashboard (M03 AC01, M04 AC01)", async ({
    page,
    context,
    request,
  }) => {
    await signedIn(
      context,
      await seedUser(request, `asha-${unique()}@example.test`),
    );
    await completeOnboarding(page);
    await expect(page.getByText("Private")).toBeVisible();
    await page.getByRole("button", { name: "Activate my workspace" }).click();
    await expect(
      page.getByRole("heading", { name: /You’re all set, Asha Rao/ }),
    ).toBeVisible();
    await expect(page.getByText(/not AI-generated/).first()).toBeVisible();
    await page.getByRole("link", { name: "Open Creator Studio" }).click();
    await expect(page).toHaveURL(/\/creator\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "starting routine",
    );
    const n = await page.locator("[data-tour='actions'] .st-item").count();
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(5);
    await expect(page.getByText("Not available yet · M13")).toBeVisible();
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/[₹$€£]\s?\d|wallet|\d[\d,]* followers/i);
  });

  test("daily actions persist across reloads and reflect real state (M04 AC03)", async ({
    page,
    context,
    request,
  }) => {
    const seed = await seedUser(request, `act-${unique()}@example.test`);
    await signedIn(context, seed);
    await completeOnboarding(page);
    await activate(page);
    await page.goto("/creator/actions");
    const before = await page
      .locator("main .st-card")
      .first()
      .locator(".st-item")
      .count();
    await page.reload();
    expect(
      await page.locator("main .st-card").first().locator(".st-item").count(),
    ).toBe(before); // never regenerated
    const first = page.locator("main .st-item").first();
    const title = (await first.locator("h3").innerText()).trim();
    await first.getByRole("button", { name: /^Done:/ }).click();
    await expect(page).toHaveURL(/\/creator\/actions$/);
    await expect(
      page.locator("main .st-item", { hasText: title }).first(),
    ).toContainText("Completed");
    await page.reload();
    await expect(
      page.locator("main .st-item", { hasText: title }).first(),
    ).toContainText("Completed");
    const pending = page.locator("main .st-item[data-status='pending']");
    await pending
      .first()
      .getByRole("button", { name: /^Skip:/ })
      .click();
    await expect(
      page.locator("main .st-item[data-status='skipped']"),
    ).toHaveCount(1); // wait for the request to land
    await pending
      .first()
      .getByRole("button", { name: /^Later:/ })
      .click();
    await expect(
      page.locator("main .st-item[data-status='deferred']"),
    ).toHaveCount(1);
    await expect(
      page.locator("main .st-item[data-status='skipped']"),
    ).toHaveCount(1);
    await page.goto("/creator/dashboard");
    await expect(page.getByText(/1 of \d done today/)).toBeVisible();
    // the first action is linked to the M03 plan: its completion shows there too
    await page.goto("/onboarding/creator/complete");
    await expect(
      page.getByText(/1 of \d.*plan actions done|Done/).first(),
    ).toBeVisible();
  });

  test("quick create, progress recording, charts, search and tenant isolation (M04 AC04)", async ({
    page,
    context,
    request,
    browser,
  }) => {
    const word = `zebra${unique()}`;
    const a = await seedUser(request, `qa-${unique()}@example.test`);
    await signedIn(context, a);
    await completeOnboarding(page);
    await activate(page);
    await page.goto("/creator/dashboard");
    await page.getByRole("button", { name: "Quick create" }).click();
    const dialog = page.getByRole("dialog", { name: "Quick create" });
    await dialog.getByLabel("Idea", { exact: true }).fill(`${word} reels`);
    await dialog.getByRole("button", { name: "Save idea" }).click();
    await expect(dialog.getByText("Idea saved.")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto("/creator/create");
    await expect(page.getByText(`${word} reels`)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Your ideas \(1\)/ }),
    ).toBeVisible();

    await page.goto("/creator/progress");
    const form = page
      .locator("main")
      .getByRole("form", { name: "Record progress" });
    await expect(page.locator("svg.st-chart")).toHaveCount(0); // no data, no chart
    await form.getByLabel("Your number right now").fill("0"); // a real zero
    await form
      .getByLabel("Date")
      .fill(new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10));
    await form.getByRole("button", { name: "Record progress" }).click();
    await expect(form.getByText(/Progress recorded/)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/Self-reported/).first()).toBeVisible();
    await expect(page.locator("svg.st-chart")).toHaveCount(0); // one observation is not a trend
    await form.getByLabel("Your number right now").fill("25");
    await form.getByRole("button", { name: "Record progress" }).click();
    await expect(form.getByText(/Progress recorded/)).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("img", { name: /2 self-reported observations/ }),
    ).toBeVisible();
    await expect(
      page.getByText(/does not show what caused the change/),
    ).toBeVisible();

    await page.goto(`/creator/search?q=${word}`);
    await expect(page.getByRole("status")).toContainText("1 result");
    await expect(
      page.getByRole("link", { name: `${word} reels` }),
    ).toBeVisible();

    // a different Creator searching for the same word sees nothing
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    const b = await seedUser(request, `qb-${unique()}@example.test`);
    await signedIn(ctxB, b);
    await completeOnboarding(pageB);
    await activate(pageB);
    await pageB.goto(`/creator/search?q=${word}`);
    await expect(pageB.getByRole("status")).toContainText("0 results");
    await expect(pageB.getByText(`${word} reels`)).toHaveCount(0); // the other tenant's idea is never present (the page only echoes the caller's own query)
    await pageB.goto("/creator/create");
    await expect(
      pageB.getByRole("heading", { name: /Your ideas \(0\)/ }),
    ).toBeVisible();
    await ctxB.close();
  });

  test("dashboard preferences and the walkthrough persist (M04 AC05)", async ({
    page,
    context,
    request,
  }) => {
    await signedIn(
      context,
      await seedUser(request, `pref-${unique()}@example.test`),
    );
    await completeOnboarding(page);
    await activate(page);
    await page.goto("/creator/dashboard");
    await expect(
      page.getByRole("heading", { name: "Commercial overview" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Product walkthrough offer" }),
    ).toBeVisible();
    const saved = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        !!r.request().headers()["next-action"],
    );
    await page.getByRole("button", { name: "Not now" }).click();
    expect((await saved).status()).toBe(200); // the server action really ran before we reload
    await page.reload();
    await expect(
      page.getByRole("region", { name: "Product walkthrough offer" }),
    ).toHaveCount(0); // dismissal persisted

    await page.goto("/creator/settings/dashboard");
    await page.getByLabel("Commercial summary").uncheck();
    await page.getByLabel("Milestones and streaks").uncheck();
    await page.getByLabel("Time zone").selectOption("America/New_York");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved.")).toBeVisible();
    await page.goto("/creator/dashboard");
    await expect(
      page.getByRole("heading", { name: "Commercial overview" }),
    ).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Milestones" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("region", { name: "Important notices" }),
    ).toContainText("Your profile is private"); // cannot be hidden
    await page.goto("/creator/settings/dashboard");
    await expect(page.getByLabel("Time zone")).toHaveValue("America/New_York");
    await page.getByRole("button", { name: "Reset to defaults" }).click();
    await expect(page.getByText("Settings reset to defaults.")).toBeVisible();
    await expect(page.getByLabel("Commercial summary")).toBeChecked();
    await expect(page.getByLabel("Time zone")).toHaveValue("Asia/Kolkata");

    await page.getByRole("button", { name: "Replay the walkthrough" }).click();
    await expect(page).toHaveURL(/\/creator\/dashboard\?tour=1/);
    await expect(
      page.getByRole("region", { name: "Product walkthrough" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Skip tour" }).click();
  });

  test("notifications show only real events, with no unread count", async ({
    page,
    context,
    request,
  }) => {
    await signedIn(
      context,
      await seedUser(request, `note-${unique()}@example.test`),
    );
    await completeOnboarding(page);
    await activate(page);
    await page.goto("/creator/notifications");
    await expect(
      page.getByText("Onboarding completed and workspace activated"),
    ).toBeVisible();
    await expect(page.getByText("Creator workspace created")).toBeVisible();
    expect(await page.locator("body").innerText()).not.toMatch(
      /\b\d+\s+unread\b/i,
    ); // no numeric unread badge anywhere
    await expect(page.getByRole("link", { name: "Notifications" })).toHaveText(
      "",
    ); // the bell carries no count
  });

  test("log out (M02) ends access to Creator Studio", async ({
    page,
    context,
    request,
  }) => {
    await signedIn(
      context,
      await seedUser(request, `out-${unique()}@example.test`),
    );
    await completeOnboarding(page);
    await activate(page);
    await page.goto("/creator/dashboard");
    await page.locator(".st-side details.st-account summary").click();
    await page
      .locator(".st-side")
      .getByRole("button", { name: /Log out/ })
      .click();
    await page.waitForURL(/\/(login|$)/);
    await page.goto("/creator/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("the one-click test sign-in lands in the real onboarding and is reusable", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto(
      `http://127.0.0.1:54331/__test/login?email=manual-${unique()}@example.test&to=/onboarding/creator`,
    );
    await expect(page).toHaveURL(/\/onboarding\/creator$/);
    await expect(
      page.getByRole("heading", { name: "Welcome to AURA" }),
    ).toBeVisible();
    await page.goto(
      "http://127.0.0.1:54331/__test/login?email=x@example.test&to=//evil.example",
    ); // open redirect is refused
    await expect(page).toHaveURL(/127\.0\.0\.1:3103\/onboarding\/creator/);
  });
});
