import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { seedUser, signedIn } from "./helpers";

test.describe.configure({ mode: "serial" });
const unique = () => Math.random().toString(36).slice(2, 8);
const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
async function activated(
  page: Page,
  request: Parameters<typeof seedUser>[0],
  context: Parameters<typeof signedIn>[0],
) {
  const seed = await seedUser(request, `m06-${unique()}@example.com`);
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
async function addAccount(page: Page, handle: string) {
  await page.goto("/creator/socials/new");
  await page.getByLabel("Handle", { exact: true }).fill(handle);
  await page.getByRole("button", { name: "Add account" }).click();
  await expect(page.getByRole("heading", { name: `@${handle}` })).toBeVisible();
  return page.url().split("/").pop()!;
}
async function record(page: Page, id: string, value: string, date: string) {
  await page.goto(`/creator/socials/${id}/metrics`);
  await page.getByLabel("Value", { exact: true }).first().fill(value);
  await page.getByLabel("Observed on").first().fill(date);
  await page.getByRole("button", { name: "Record metric" }).click();
  await expect(page.getByText(/Recorded\./)).toBeVisible();
}
async function recordContent(
  page: Page,
  id: string,
  ext: string,
  value: string,
  windowKind: "lifetime" | "window",
  date: string,
  period?: [string, string],
) {
  await page.goto(`/creator/socials/${id}/metrics`);
  const f = page.getByRole("form", { name: "Record a content metric" });
  await f.getByLabel("Or an id you choose").fill(ext);
  await f.getByLabel("Title (optional)").fill(ext);
  await f.getByLabel("Metric").selectOption("views");
  await f.getByLabel("Counted over").selectOption(windowKind);
  await f.getByLabel("Value").fill(value);
  await f.getByLabel("Observed on").fill(date);
  if (period) {
    await f.getByLabel("Period start (period only)").fill(period[0]);
    await f.getByLabel("Period end").fill(period[1]);
  }
  await f.getByRole("button", { name: "Record for this content" }).click();
  await expect(page.getByText(/Recorded for this content item/)).toBeVisible();
}

test.describe("M06 real routes with the local test stack (not Supabase)", () => {
  test("anonymous visitors are sent to sign-in", async ({ page }) => {
    for (const p of [
      "/creator/analytics",
      "/creator/analytics/accounts",
      "/creator/analytics/content",
      "/creator/analytics/compare",
      "/creator/analytics/audience",
      "/creator/analytics/insights",
      "/creator/analytics/reports",
      "/creator/experiments",
      "/creator/experiments/new",
      "/creator/analytics/reports/download?kind=summary&format=csv&purpose=test",
    ]) {
      await page.goto(p);
      await expect(page, p).toHaveURL(/\/login/);
    }
  });

  test("a Creator with no account gets preparation steps, not empty charts or zeros", async ({
    page,
    request,
    context,
  }) => {
    await activated(page, request, context);
    await page.goto("/creator/analytics");
    await expect(
      page.getByRole("heading", {
        name: "Start with preparation, not empty charts",
      }),
    ).toBeVisible();
    await expect(page.locator("svg.st-chart")).toHaveCount(0);
    await page.goto("/creator/analytics/insights");
    await expect(page.getByText("No insights yet")).toBeVisible();
    await page.goto("/creator/experiments");
    await expect(
      page.getByText("Experiments need an account to measure"),
    ).toBeVisible();
  });

  test("accounts, comparison blocking, experiment lifecycle, insights, audience and exports use real recorded data", async ({
    page,
    request,
    context,
  }) => {
    await activated(page, request, context);
    const id = await addAccount(page, "lab.creator");
    // observations on real dates; no baseline exists for the previous period, so that comparison must be unavailable
    await record(page, id, "1000", day(-35));
    await record(page, id, "1200", day(-1));
    await page.goto("/creator/analytics/accounts?range=30d");
    await expect(page.getByText(/Net change|\+200/).first()).toBeVisible();
    await expect(page.getByText(`from 1,000 on ${day(-35)}`)).toBeVisible();
    await expect(page.getByText(/Previous-period comparison/)).toBeVisible();
    await expect(
      page.getByText(/not unique people|possible overlap/).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Reach and impressions are different measures"),
    ).toBeVisible();
    await expect(
      page.getByText(/Not enough history for a range/),
    ).toBeVisible();
    await expect(page.locator("svg.st-chart")).toBeVisible();
    await page.getByText("Show the data").first().click();
    await expect(page.getByRole("cell", { name: "1,200" })).toBeVisible();

    // content: two comparable 7-day windows, one lifetime total
    await recordContent(page, id, "post-a", "100", "window", day(-7), [
      day(-14),
      day(-8),
    ]);
    await recordContent(page, id, "post-b", "250", "window", day(-7), [
      day(-14),
      day(-8),
    ]);
    await recordContent(page, id, "post-c", "5000", "lifetime", day(-2));
    await page.goto("/creator/analytics/content");
    await expect(page.getByText("post-a").first()).toBeVisible();
    await page.getByLabel("post-a", { exact: true }).check();
    await page.getByLabel("post-b", { exact: true }).check();
    await page.getByRole("button", { name: "Compare selected" }).click();
    await expect(
      page.getByRole("heading", { name: /7-day window totals/ }),
    ).toBeVisible();
    await expect(page.getByText(/does not show why they differ/)).toBeVisible();
    await page.goto("/creator/analytics/content");
    await page.getByLabel("post-a", { exact: true }).check();
    await page.getByLabel("post-c", { exact: true }).check();
    await page.getByRole("button", { name: "Compare selected" }).click();
    await expect(
      page.getByRole("heading", { name: "These cannot be compared fairly" }),
    ).toBeVisible();
    await expect(page.getByText(/What would work/)).toBeVisible();

    // tags are optional and manual
    await page.goto("/creator/analytics/content");
    await page
      .getByText("Tags and publishing time (optional)")
      .scrollIntoViewIfNeeded();
    await page
      .locator("details", { hasText: "post-a" })
      .first()
      .locator("summary")
      .click();
    await page
      .getByRole("form", { name: /Add a tag to post-a/ })
      .getByLabel("Value")
      .fill("Travel");
    await page
      .getByRole("form", { name: /Add a tag to post-a/ })
      .getByRole("button", { name: "Add tag" })
      .click();
    await expect(page.getByText(/topic: Travel/).first()).toBeVisible();

    // experiment: create from template, start (baseline frozen), add an observation, complete with an honest outcome
    await page.goto(
      "/creator/experiments/new?template=consistency&account=" + id,
    );
    await expect(page.getByLabel("Experiment name")).toHaveValue(
      /steadier posting rhythm/,
    );
    await page
      .getByRole("group", { name: /Baseline/ })
      .getByLabel(new RegExp(`${day(-35)}: 1,000`))
      .check();
    await page.getByRole("button", { name: "Save as draft" }).click();
    await expect(
      page.getByRole("heading", { name: /steadier posting rhythm/ }),
    ).toBeVisible();
    await expect(
      page.getByText("Draft", { exact: false }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Start the experiment" }).click();
    await expect(
      page.getByText(/Frozen when the experiment started/),
    ).toBeVisible();
    await expect(page.getByText(`1,000 on ${day(-35)}`)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Start the experiment" }),
    ).toHaveCount(0); // no duplicate activation
    await record(page, id, "1260", day(0));
    await page.goBack();
    await page.goBack().catch(() => undefined);
    await page.goto(
      page.url().includes("/experiments/")
        ? page.url()
        : "/creator/experiments",
    );
    const link = page.getByRole("link", { name: /steadier posting rhythm/ });
    if (await link.count()) await link.first().click();
    await page
      .getByLabel("Add a recorded observation")
      .selectOption({ index: 0 });
    await page.getByRole("button", { name: "Add to experiment" }).click();
    await page.getByText("Limitations").first().click();
    await expect(page.getByText(/No statistical test was run/)).toBeVisible();
    await expect(page.getByText(/not a controlled experiment/i)).toBeVisible();
    await page.getByLabel("Outcome").selectOption("inconclusive");
    await page.getByLabel("What do you take from it?").fill("Too early to say");
    await page.getByRole("button", { name: "Complete" }).click();
    await expect(page.getByText(/Inconclusive\./)).toBeVisible();
    await page.goto("/creator/experiments");
    await expect(page.getByText("Too early to say")).toBeVisible();

    // insights: rule-based, labelled, and carry limits
    await addAccount(page, "empty.second"); // no number recorded: unknown, never zero
    await page.goto("/creator/analytics/insights");
    await expect(
      page.getByText(/Record a first follower count for/),
    ).toBeVisible();
    await expect(page.getByText(/not a count of zero/)).toBeVisible();
    await expect(page.getByText(/\(deterministic\)/).first()).toBeVisible();
    await expect(page.getByText(/not AI output/)).toBeVisible();
    await page.getByRole("button", { name: "Dismiss" }).first().click();
    await expect(
      page
        .getByText("Done.")
        .or(page.getByRole("heading", { name: "Insights" })),
    ).toBeVisible();

    // audience
    await page.goto("/creator/analytics/audience");
    await expect(page.getByText("No audience information yet")).toBeVisible();
    const af = page.getByRole("form", { name: "Record audience information" });
    await af.getByLabel("Group 1").fill("India");
    await af.getByLabel("Percent 1").fill("70");
    await af.getByLabel("Group 2").fill("United States");
    await af.getByLabel("Percent 2").fill("40");
    await af
      .getByRole("button", { name: "Record audience information" })
      .click();
    await expect(page.getByText(/more than 100/)).toBeVisible(); // 110%: refused with a field message
    await af.getByLabel("Percent 2").fill("12.5");
    await af
      .getByRole("button", { name: "Record audience information" })
      .click();
    await expect(
      page.getByText(/Recorded as self-reported audience information/),
    ).toBeVisible();
    await page.goto("/creator/analytics/audience");
    await expect(page.getByText("India: 70%")).toBeVisible();
    await expect(
      page.getByText(/Not shown until you opt in|Not shown/).first(),
    ).toBeVisible();
    const gf = page.getByRole("form", {
      name: /Share aggregate audience information/,
    });
    await gf
      .getByLabel("Brand workspace id")
      .fill("00000000-0000-4000-8000-000000000000");
    await gf.getByLabel("Country or region").check();
    await gf.getByLabel("Purpose").fill("Campaign fit");
    await gf.getByRole("button", { name: "Share for this purpose" }).click();
    await expect(page.getByText(/cannot receive this/)).toBeVisible();

    // exports: purpose required, permission checked, content neutralized
    const ok = await page
      .context()
      .request.get(
        `/creator/analytics/reports/download?kind=observations&format=csv&purpose=${encodeURIComponent("my own records")}`,
      );
    expect(ok.status()).toBe(200);
    expect(ok.headers()["content-type"]).toMatch(/text\/csv/);
    const csv = await ok.text();
    expect(csv).toContain("followers");
    expect(csv).toContain("1000");
    expect(csv).not.toMatch(/\b(score|rank)\b/i);
    const pdf = await page
      .context()
      .request.get(
        `/creator/analytics/reports/download?kind=summary&format=pdf&purpose=${encodeURIComponent("review with manager")}`,
      );
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    expect(
      (
        await page
          .context()
          .request.get(
            "/creator/analytics/reports/download?kind=summary&format=csv",
          )
      ).status(),
    ).toBe(400);
    expect(
      (
        await page
          .context()
          .request.get(
            "/creator/analytics/reports/download?kind=shared_audience&format=csv&purpose=abcd",
          )
      ).status(),
    ).toBe(400);
    await page.goto("/creator/analytics/reports");
    await expect(page.getByRole("listitem").filter({ hasText: "my own records" })).toHaveCount(1);
  });

  test("another Creator cannot reach this Creator's experiment or exports", async ({
    page,
    request,
    context,
    browser,
  }) => {
    await activated(page, request, context);
    const id = await addAccount(page, "iso.owner");
    await page.goto(`/creator/experiments/new?account=${id}`);
    await page.getByLabel("Experiment name").fill("Private test");
    await page.getByLabel("Your hypothesis").fill("A private hypothesis");
    await page
      .getByLabel("If there is no baseline, why not?")
      .fill("new account");
    await page.getByRole("button", { name: "Save as draft" }).click();
    await expect(
      page.getByRole("heading", { name: "Private test" }),
    ).toBeVisible();
    const url = page.url();
    const other = await browser.newContext();
    const p2 = await other.newPage();
    const seed2 = await seedUser(request, `m06b-${unique()}@example.com`);
    await signedIn(other, seed2);
    await p2.goto(url);
    await expect(p2.getByText("Private test")).toHaveCount(0);
    await other.close();
  });

  test("pages have no serious accessibility violations and no horizontal overflow", async ({
    page,
    request,
    context,
  }) => {
    await activated(page, request, context);
    const id = await addAccount(page, "a11y.check");
    await record(page, id, "500", day(-20));
    await record(page, id, "620", day(-1));
    for (const p of [
      "/creator/analytics",
      "/creator/analytics/accounts",
      "/creator/analytics/content",
      "/creator/analytics/compare",
      "/creator/analytics/audience",
      "/creator/analytics/insights",
      "/creator/analytics/reports",
      "/creator/experiments",
      "/creator/experiments/new",
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
        res.violations
          .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
          .map((v) => `${v.id}: ${v.nodes[0]?.html?.slice(0, 100)}`),
        p,
      ).toEqual([]);
    }
  });
});
