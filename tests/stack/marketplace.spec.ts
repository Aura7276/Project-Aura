import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { seedUser, signedIn, verifyBrand } from "./helpers";

test.describe.configure({ mode: "serial" });
const unique = () => Math.random().toString(36).slice(2, 8);
async function activated(
  page: Page,
  request: Parameters<typeof seedUser>[0],
  context: Parameters<typeof signedIn>[0],
) {
  const seed = await seedUser(request, `m10-${unique()}@example.com`);
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
const later = (d: number) =>
  new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
async function brandDraft(
  page: Page,
  title: string,
  opts: {
    category?: string;
    money?: [string, string];
    minFollowers?: string;
    visibility?: string;
  } = {},
) {
  await page.goto("/brand/campaigns");
  const nf = page.getByRole("form", { name: "Start a campaign" });
  await nf.getByLabel("Type").selectOption(opts.category ?? "paid");
  await nf.getByLabel("Working title").fill(title);
  await nf.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const f = page.getByRole("form", { name: "Campaign terms" });
  if (opts.visibility)
    await f.getByLabel("Who can see it").selectOption(opts.visibility);
  await f
    .getByLabel("Summary (shown on cards)")
    .fill("Short travel reels for our budget hostel launch in Goa.");
  await f
    .getByLabel("Brief", { exact: true })
    .fill(
      "We are launching a hostel for budget travellers. Show the rooms, the rooftop and the food in your own style.",
    );
  await f
    .getByLabel(/Deliverables, one per line/)
    .fill("2 x Reel on Instagram\n1 x Story on Instagram");
  await f.getByLabel("Applications close on").fill(later(20));
  if (opts.money) {
    await f.getByLabel("Money").selectOption("range");
    await f.getByLabel("Amount (or lower end) (optional)").fill(opts.money[0]);
    await f.getByLabel("Upper end (optional)").fill(opts.money[1]);
  } else if ((opts.category ?? "paid") !== "paid") {
    await f.getByLabel("Money").selectOption("none");
    if (opts.category === "event")
      await f
        .getByLabel("Experience or event (optional)")
        .fill("Entry and dinner at the opening night");
    else
      await f
        .getByLabel("Products the Creator receives (optional)")
        .fill("Two nights at the hostel");
  }
  await f.getByLabel("Usage rights (months) (optional)").fill("6");
  await f.getByLabel(/Where you will use the content/).fill("organic, website");
  if (opts.minFollowers)
    await f.getByLabel(/Mandatory: minimum followers/).fill(opts.minFollowers);
  await f.getByRole("button", { name: "Save draft" }).click();
  await expect(
    page.getByText(/Draft saved|Saved as a new draft/),
  ).toBeVisible();
  return page.url().split("?")[0];
}

test.describe("M10 real routes with the local test stack (not Supabase)", () => {
  test("anonymous visitors are sent to sign-in", async ({ page }) => {
    for (const p of [
      "/creator/marketplace",
      "/creator/marketplace/explore",
      "/creator/marketplace/saved",
      "/brand/campaigns",
      "/admin/marketplace",
    ]) {
      await page.goto(p);
      await expect(page, p).toHaveURL(/\/login/);
    }
  });

  test("Brand drafts, verification gate, reviewer approval, Creator discovery, eligibility, changes and reporting", async ({
    page,
    request,
    context,
    browser,
  }) => {
    test.setTimeout(240_000);
    // a Creator with an empty marketplace first
    await activated(page, request, context);
    await page.goto("/creator/marketplace");
    await expect(page.getByText("Nothing to show here yet")).toBeVisible();
    await expect(
      page.getByText(
        /Campaigns appear only after a Brand has passed business verification/,
      ),
    ).toBeVisible();
    // Brand (MFA) drafts but cannot publish
    const brand = await seedUser(
      request,
      `brand-${unique()}@example.com`,
      "Hostel Co Owner",
      "brand",
      { mfa: true },
    );
    const b = await browser.newContext();
    await signedIn(b, brand);
    const bp = await b.newPage();
    await bp.goto("/brand/campaigns");
    await expect(
      bp.getByText(/Your business is not verified yet/),
    ).toBeVisible();
    const paidUrl = await brandDraft(bp, `Goa hostel reels ${unique()}`, {
      money: ["5000", "9000"],
      minFollowers: "1000",
    });
    await expect(
      bp.getByRole("button", { name: "Publish campaign" }),
    ).toBeDisabled();
    // interim verification by an MFA reviewer
    const reviewer = await seedUser(
      request,
      `rev-${unique()}@example.com`,
      "Platform Reviewer",
      "creator",
      { admin: true },
    );
    const r = await browser.newContext();
    await signedIn(r, reviewer);
    const rp = await r.newPage();
    await rp.goto("/admin/marketplace");
    await expect(
      rp.getByRole("heading", { name: "Marketplace review" }),
    ).toBeVisible();
    // business verification goes through the M14 case workflow
    await verifyBrand(bp, rp, brand.workspace_id);
    // first publication goes to review, then the reviewer approves
    await bp.goto(paidUrl);
    await expect(bp.getByText(/Business verified/)).toBeVisible();
    await bp.getByRole("button", { name: "Publish campaign" }).click();
    await expect(bp.getByText(/Sent to a reviewer/)).toBeVisible();
    await rp.goto("/admin/marketplace");
    const camp = rp
      .getByRole("listitem")
      .filter({ hasText: "Goa hostel reels" })
      .first();
    await camp.getByLabel("Reason").fill("Clear terms");
    await camp.getByRole("button", { name: "Record" }).click();
    await expect(rp.getByText("Decision recorded.")).toBeVisible();
    // a UGC campaign publishes directly now (not the first)
    await brandDraft(bp, `Unboxing videos ${unique()}`, { category: "ugc" });
    await bp.getByRole("button", { name: "Publish campaign" }).click();
    await expect(bp.getByText(/Published\./)).toBeVisible();
    // the Creator (no account, so below 100) sees both, UGC first with the reason, the paid one as not eligible
    await page.goto("/creator/marketplace");
    await expect(
      page.getByText(/You are still building your audience/),
    ).toBeVisible();
    const cards = page.locator(".mk-card");
    await expect(cards.first()).toContainText("UGC");
    await expect(cards.first()).toContainText(
      "Suited to creators still building an audience",
    );
    await expect(
      page.locator(".mk-card", { hasText: "Goa hostel reels" }),
    ).toContainText(/Missing information|Not eligible/);
    await expect(
      page.locator(".mk-card", { hasText: "Goa hostel reels" }),
    ).toContainText("₹5,000 to ₹9,000");
    // detail, eligibility and apply check
    await page
      .locator(".mk-card", { hasText: "Goa hostel reels" })
      .getByRole("link")
      .first()
      .click();
    await expect(page.getByText("Business verified").first()).toBeVisible();
    await expect(
      page.getByText("Number of positions not disclosed"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Check and apply" }).click();
    await expect(page.getByText(/You cannot apply yet/)).toBeVisible();
    await expect(
      page.getByText(/One of your own accounts with 1000 or more followers/),
    ).toBeVisible();
    await expect(page.getByText("No matching account is added.")).toBeVisible();
    await page.getByRole("link", { name: "Review the terms" }).click();
    await expect(page.getByText(/not an AI assessment/)).toBeVisible();
    // save, then the Brand makes a material change: the Creator is alerted
    await page.getByRole("link", { name: "Brief" }).click();
    await page.getByRole("button", { name: "Save campaign" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
    await bp.goto(paidUrl);
    const f = bp.getByRole("form", { name: "Campaign terms" });
    await f.getByLabel("Upper end (optional)").fill("12000");
    await f.getByRole("button", { name: "Save draft" }).click();
    await expect(bp.getByText(/Saved as a new draft version/)).toBeVisible();
    await bp.reload();
    await expect(
      bp.getByText(/Unpublished changes to compensation/),
    ).toBeVisible();
    await bp.getByRole("button", { name: "Publish changes" }).click();
    await expect(bp.getByText(/Published\./)).toBeVisible();
    await page.goto("/creator/marketplace/alerts");
    await expect(
      page.getByText(/Terms changed: Goa hostel reels/),
    ).toBeVisible();
    await expect(page.getByText(/Changed: compensation/)).toBeVisible();
    // compare, saved search, hide and report
    await page.goto("/creator/marketplace/compare");
    await page
      .getByRole("link", { name: /Goa hostel reels/ })
      .first()
      .click();
    await expect(page.getByRole("row", { name: /Compensation/ })).toBeVisible();
    await page.goto("/creator/marketplace/explore?q=unboxing");
    await expect(page.getByText("1 campaign")).toBeVisible();
    await page.getByRole("button", { name: "Save search" }).click();
    await expect(page.getByRole("link", { name: /unboxing/ })).toBeVisible();
    await page.goto("/creator/marketplace/preferences");
    await page.getByRole("button", { name: "Hide UGC" }).click();
    await expect(page.getByRole("button", { name: "Show UGC" })).toBeVisible();
    await page.goto("/creator/marketplace/explore");
    await expect(
      page.getByText(/hidden by your preferences/).first(),
    ).toBeVisible();
    await page.goto("/creator/marketplace/preferences");
    await page.getByRole("button", { name: "Show UGC" }).click();
    await expect(page.getByRole("button", { name: "Hide UGC" })).toBeVisible();
    await page.goto("/creator/marketplace");
    await page
      .locator(".mk-card", { hasText: "Unboxing videos" })
      .getByRole("link")
      .first()
      .click();
    await page.getByText("Report this campaign").click();
    await page.getByLabel("Asks me to pay a fee or deposit").check();
    await page.getByRole("button", { name: "Send report" }).click();
    await expect(
      page.getByText(/A reviewer will look at (this report|it)/),
    ).toBeVisible();
    await rp.goto("/admin/marketplace");
    await expect(rp.getByRole("heading", { name: "Reports" })).toBeVisible();
    await expect(rp.getByText(/fee requested/)).toBeVisible();
    await b.close();
    await r.close();
  });

  test("marketplace and Brand pages have no serious accessibility violations and no horizontal overflow", async ({
    page,
    request,
    context,
    browser,
  }) => {
    test.setTimeout(240_000);
    await activated(page, request, context);
    const brand = await seedUser(
      request,
      `brand-${unique()}@example.com`,
      "Brand Owner",
      "brand",
      { mfa: true },
    );
    const b = await browser.newContext();
    await signedIn(b, brand);
    const bp = await b.newPage();
    const url = await brandDraft(bp, `A11y campaign ${unique()}`, {
      money: ["3000", "6000"],
    });
    for (const [pg, p] of [
      [bp, "/brand/campaigns"],
      [bp, url.replace(/^https?:\/\/[^/]+/, "")],
      [page, "/creator/marketplace"],
      [page, "/creator/marketplace/explore"],
      [page, "/creator/marketplace/category/ugc"],
      [page, "/creator/marketplace/saved"],
      [page, "/creator/marketplace/recent"],
      [page, "/creator/marketplace/compare"],
      [page, "/creator/marketplace/searches"],
      [page, "/creator/marketplace/alerts"],
      [page, "/creator/marketplace/preferences"],
    ] as const) {
      for (const w of [320, 768, 1280]) {
        await pg.setViewportSize({ width: w, height: 800 });
        await pg.goto(p);
        const over = await pg.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(over, `${p} @${w}`).toBeLessThanOrEqual(1);
      }
      const res = await new AxeBuilder({ page: pg })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(
        res.violations
          .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
          .map((v) => `${v.id}: ${v.nodes[0]?.html?.slice(0, 120)}`),
        p,
      ).toEqual([]);
    }
    await b.close();
  });
});

test.describe("M10 visual evidence (screenshots of real pages with sample data typed in by the test)", () => {
  test("captures For You, a campaign, eligibility, comparison and the Brand editor", async ({
    page,
    request,
    context,
    browser,
  }) => {
    test.setTimeout(240_000);
    const dir = "docs/development/evidence/m10";
    await activated(page, request, context);
    const brand = await seedUser(
      request,
      `brand-${unique()}@example.com`,
      "Sample Hostels (illustrative)",
      "brand",
      { mfa: true },
    );
    const b = await browser.newContext({ deviceScaleFactor: 2 });
    await signedIn(b, brand);
    const bp = await b.newPage();
    const reviewer = await seedUser(
      request,
      `rev-${unique()}@example.com`,
      "Reviewer",
      "creator",
      { admin: true },
    );
    const r = await browser.newContext();
    await signedIn(r, reviewer);
    const rp = await r.newPage();
    const paid = await brandDraft(bp, "Goa hostel launch reels", {
      money: ["8000", "12000"],
      minFollowers: "1000",
    });
    await rp.goto("/admin/marketplace");
    const row = rp.locator("li", {
      has: rp.locator(`input[name="id"][value="${brand.workspace_id}"]`),
    });
    await row.getByLabel("Reason").fill("Documents checked");
    await row.getByRole("button", { name: "Record" }).click();
    await expect(rp.getByText("Decision recorded.")).toBeVisible();
    await bp.goto(paid);
    await bp.getByRole("button", { name: "Publish campaign" }).click();
    await expect(bp.getByText(/Sent to a reviewer/)).toBeVisible();
    await rp.goto("/admin/marketplace");
    const camp = rp
      .getByRole("listitem")
      .filter({ hasText: "Goa hostel launch reels" })
      .first();
    await camp.getByLabel("Reason").fill("Clear terms");
    await camp.getByRole("button", { name: "Record" }).click();
    await expect(rp.getByText("Decision recorded.")).toBeVisible();
    for (const [t, cat] of [
      ["Unboxing videos for a travel bag", "ugc"],
      ["Weekend stay in exchange for stories", "barter"],
      ["Hostel opening night", "event"],
    ] as const) {
      await brandDraft(bp, t, { category: cat });
      await bp.getByRole("button", { name: "Publish campaign" }).click();
      await expect(bp.getByText(/Published\./)).toBeVisible();
    }
    await bp.setViewportSize({ width: 1280, height: 900 });
    await bp.goto(paid);
    await bp.getByRole("form", { name: "Campaign terms" }).waitFor();
    await bp.screenshot({ path: `${dir}/brand-editor-desktop.png` });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/creator/marketplace");
    await page.locator(".mk-card").first().waitFor();
    await page.screenshot({
      path: `${dir}/for-you-desktop.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/creator/marketplace");
    await page.locator(".mk-card").first().waitFor();
    await page.screenshot({
      path: `${dir}/for-you-mobile.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page
      .locator(".mk-card", { hasText: "Goa hostel launch reels" })
      .getByRole("link")
      .first()
      .click();
    await page.getByRole("button", { name: "Check and apply" }).waitFor();
    await page.screenshot({
      path: `${dir}/campaign-desktop.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Check and apply" }).click();
    await expect(page.getByText(/You cannot apply yet/)).toBeVisible();
    await page.screenshot({
      path: `${dir}/eligibility-desktop.png`,
      fullPage: true,
    });
    const ids = await page.evaluate(() => location.pathname.split("/")[3]);
    await page.goto("/creator/marketplace");
    await page.locator(".mk-card").first().waitFor();
    const other = await page
      .locator(".mk-card", { hasText: "Weekend stay" })
      .getByRole("link")
      .first()
      .getAttribute("href");
    await page.goto(
      `/creator/marketplace/compare?ids=${ids},${other!.split("/").pop()}`,
    );
    await page.screenshot({
      path: `${dir}/compare-desktop.png`,
      fullPage: true,
    });
    await b.close();
    await r.close();
  });
});
