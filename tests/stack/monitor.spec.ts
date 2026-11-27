// M19 end to end on the real routes, against the local test stack (real PostgreSQL migrations, NOT Supabase).
// Named to sort after marketplace.spec.ts: the stack database is shared and the M10 suite first checks an empty marketplace.
import { expect, test, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import {
  publishFirstDeliverable,
  seedUser,
  signedIn,
  verifyBrand,
} from "./helpers";

test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 20_000 });
const unique = () => Math.random().toString(36).slice(2, 8);
const later = (d: number) =>
  new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
type Req = Parameters<typeof seedUser>[0];
async function creator(
  browser: Browser,
  request: Req,
  handle: string,
  username?: string,
) {
  const seed = await seedUser(
    request,
    `m11-${unique()}@example.com`,
    "Asha Rao",
  );
  const ctx = await browser.newContext();
  await signedIn(ctx, seed);
  const page = await ctx.newPage();
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
  await page.goto("/creator/socials/new");
  await page.getByLabel("Handle", { exact: true }).fill(handle);
  await page.getByRole("button", { name: "Add account" }).click();
  await expect(page.getByRole("heading", { name: `@${handle}` })).toBeVisible();
  if (username) {
    await page.goto("/creator/profile/edit");
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Headline (optional)").fill("Budget travel stories");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await page.goto("/creator/profile");
    await page.getByRole("button", { name: "Publish profile" }).click();
    await expect(
      page.getByRole("heading", { name: "Your profile is published" }),
    ).toBeVisible();
  }
  return { seed, ctx, page };
}
/** A verified Brand with one live UGC campaign (first publication approved by an MFA reviewer). */
async function liveCampaign(browser: Browser, request: Req, title: string) {
  const brand = await seedUser(
    request,
    `brand-${unique()}@example.com`,
    "Hostel Co Owner",
    "brand",
    { mfa: true },
  );
  const reviewer = await seedUser(
    request,
    `rev-${unique()}@example.com`,
    "Platform Reviewer",
    "creator",
    { admin: true },
  );
  const b = await browser.newContext();
  await signedIn(b, brand);
  const bp = await b.newPage();
  const r = await browser.newContext();
  await signedIn(r, reviewer);
  const rp = await r.newPage();
  await bp.goto("/brand/campaigns");
  const nf = bp.getByRole("form", { name: "Start a campaign" });
  await nf.getByLabel("Type").selectOption("ugc");
  await nf.getByLabel("Working title").fill(title);
  await nf.getByRole("button", { name: "Create draft" }).click();
  await expect(bp.getByRole("heading", { name: title })).toBeVisible();
  const f = bp.getByRole("form", { name: "Campaign terms" });
  await f
    .getByLabel("Summary (shown on cards)")
    .fill("Short unboxing videos of our travel kit, filmed in your style.");
  await f
    .getByLabel("Brief", { exact: true })
    .fill(
      "We sell a compact travel kit. Show what is inside and how you would use it on a weekend trip, in your own words.",
    );
  await f
    .getByLabel(/Deliverables, one per line/)
    .fill("2 x Video on Instagram");
  await f.getByLabel("Applications close on").fill(later(20));
  await f.getByLabel("Money").selectOption("range");
  await f.getByLabel("Amount (or lower end) (optional)").fill("3000");
  await f.getByLabel("Upper end (optional)").fill("6000");
  await f.getByLabel("Usage rights (months) (optional)").fill("6");
  await f.getByLabel(/Where you will use the content/).fill("organic, website");
  await f.getByRole("button", { name: "Save draft" }).click();
  await expect(bp.getByText(/Draft saved/)).toBeVisible();
  const url = bp.url().split("?")[0];
  await verifyBrand(bp, rp, brand.workspace_id);
  await bp.goto(url);
  await bp.getByRole("button", { name: "Publish campaign" }).click();
  await expect(bp.getByText(/Sent to a reviewer/)).toBeVisible();
  await rp.goto("/admin/marketplace");
  const camp = rp.getByRole("listitem").filter({ hasText: title }).first();
  await camp.getByLabel("Reason").fill("Clear terms");
  await camp.getByRole("button", { name: "Record" }).click();
  await expect(rp.getByText("Decision recorded.")).toBeVisible();
  return { brand, b, bp, r, rp, id: url.split("/").pop()!, url };
}
const shots = "docs/development/evidence/m19";
async function overflowAndAxe(pg: Page, p: string) {
  for (const w of [320, 768, 1280]) {
    await pg.setViewportSize({ width: w, height: 800 });
    await pg.goto(p);
    const over = await pg.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    const wide =
      over > 1
        ? await pg.evaluate(() =>
            [...document.querySelectorAll("body *")]
              .filter(
                (e) => e.getBoundingClientRect().right > window.innerWidth + 1,
              )
              .slice(0, 6)
              .map((e) => `${e.tagName}.${e.className}`)
              .join(" | "),
          )
        : "";
    expect(over, `${p} @${w} ${wide}`).toBeLessThanOrEqual(1);
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

async function applyTo(page: Page, id: string, pitch: string) {
  await page.goto(`/creator/marketplace/${id}/apply`);
  await page.getByLabel(/Why you, for this campaign/).fill(pitch);
  await page.getByLabel(/I have checked this application/).check();
  await page.getByRole("button", { name: "Send application" }).click();
  await expect(
    page.getByText(/Application sent\. You can still/),
  ).toBeVisible();
  return page.url().split("?")[0];
}

test.describe("M19 real routes with the local test stack (not Supabase)", () => {
  test("monitoring: delivery, results from both sides without double counting, payments apart, versioned reports, exports and withdrawn figures", async ({
    browser,
    request,
  }) => {
    test.setTimeout(480_000);
    mkdirSync(shots, { recursive: true });
    const title = `Monitored reels ${unique()}`;
    const { b, bp, r, id } = await liveCampaign(browser, request, title);
    const a = await creator(browser, request, `asha.${unique()}`);
    const cp = a.page;
    const appUrl = await applyTo(
      cp,
      id,
      "I film honest, practical travel videos on a budget and my audience asks me about kits like yours every week.",
    );

    // M18 → M11 → M12: offer, accept, agree the same version
    await bp.goto(`/brand/campaigns/${id}/applications`);
    await bp.locator(".sl-row").first().getByRole("link").first().click();
    await bp
      .getByRole("form", { name: "Offer a place" })
      .getByRole("button", { name: "Offer a place (72-hour hold)" })
      .click();
    await expect(bp.getByText(/Held until/).first()).toBeVisible();
    await cp.goto(appUrl);
    await cp.getByRole("button", { name: "Accept the place" }).click();
    await expect(cp).toHaveURL(/\/creator\/negotiations\//);
    const negUrl = cp.url().split("?")[0];
    const negId = negUrl.split("/").pop()!;
    const prop = cp.getByRole("form", { name: "New proposal" });
    await prop.getByLabel("Compensation (money)").fill("3000");
    await prop.getByRole("button", { name: "Send proposal" }).click();
    await expect(cp.getByText(/Proposal sent/)).toBeVisible();
    await cp.reload();
    await cp
      .getByLabel("I confirm exactly version 1 as written above.")
      .check();
    await cp.getByRole("button", { name: "Confirm version 1" }).click();
    await expect(cp.getByText(/You confirmed this version/)).toBeVisible();
    await bp.goto(`/brand/negotiations/${negId}`);
    await bp
      .getByLabel("I confirm exactly version 1 as written above.")
      .check();
    await bp.getByRole("button", { name: "Confirm version 1" }).click();
    await expect(
      bp.getByText(/Both sides confirmed the same version/).first(),
    ).toBeVisible();

    // Monitor before anything is published: the pending agreement is flagged; no results can be recorded yet
    await bp.goto(`/brand/campaigns/${id}/monitor`);
    await expect(
      bp.getByRole("heading", { name: `Monitor · ${title}` }),
    ).toBeVisible();
    await expect(
      bp.getByText(/Agreement not yet accepted by both sides/),
    ).toBeVisible();
    await expect(
      bp.getByText("Results can be recorded once a deliverable is published."),
    ).toBeVisible();

    // Test-only: mark the first deliverable published in M12 (M12 acceptance needs an approved legal template)
    await publishFirstDeliverable(request, negId);

    // Brand records cumulative views twice: the total is the latest reading, not the sum
    await bp.goto(`/brand/campaigns/${id}/monitor`);
    const rec = bp.getByRole("form", { name: "Record a result" });
    await rec.getByLabel(/^Metric/).selectOption("views");
    await rec.getByLabel(/^Value/).fill("1200");
    await rec
      .getByLabel(/^Read on/)
      .fill(new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10));
    await rec.getByRole("button", { name: "Record result" }).click();
    await expect(bp.locator(".mo-log")).toContainText("1,200");
    await rec.getByLabel(/^Metric/).selectOption("views");
    await rec.getByLabel(/^Value/).fill("1500");
    await rec
      .getByLabel(/^Read on/)
      .fill(new Date().toISOString().slice(0, 10));
    await rec.getByRole("button", { name: "Record result" }).click();
    await expect(bp.locator(".mo-log")).toContainText("1,500");
    await bp.reload();
    const totals = bp.locator(".mo-totals");
    await expect(
      totals.locator("div", { hasText: "Views" }).locator("dd").first(),
    ).toHaveText("1,500");

    // The Creator records reach from a screenshot; the Brand sees it labelled as not unique people
    await cp.goto(negUrl);
    await expect(
      cp.getByRole("heading", { name: "Results", exact: true }),
    ).toBeVisible();
    const crec = cp.getByRole("form", {
      name: "Record a result for your post",
    });
    await crec.getByLabel(/^Metric/).selectOption("reach");
    await crec.getByLabel(/^Value/).fill("900");
    await crec.getByLabel(/^Source$/).selectOption("screenshot");
    await crec.getByRole("button", { name: "Record result" }).click();
    await expect(cp.getByText(/Recorded with its source/)).toBeVisible();
    await cp.screenshot({
      path: `${shots}/creator-results-desktop.png`,
      fullPage: true,
    });
    await bp.goto(`/brand/campaigns/${id}/monitor`);
    await expect(totals.locator("div", { hasText: "Reach" })).toContainText(
      "NOT a count of unique people",
    );
    await expect(
      bp.getByText(
        /Recorded by the parties in the commercial workspace, not verified by AURA/,
      ),
    ).toBeVisible();
    await bp.screenshot({
      path: `${shots}/monitor-desktop.png`,
      fullPage: true,
    });

    // Versioned report and exports
    await bp.getByRole("link", { name: "Reports" }).click();
    const nr = bp.getByRole("form", { name: "New report" });
    await nr.getByLabel(/^Name/).fill("Weekly results");
    await nr.getByRole("button", { name: "Create report" }).click();
    await expect(bp.getByText(/Report saved as version 1/)).toBeVisible();
    const reportUrl = bp.url().split("?")[0];
    await expect(
      bp.getByRole("heading", { name: "Weekly results" }),
    ).toBeVisible();
    await bp.screenshot({
      path: `${shots}/report-desktop.png`,
      fullPage: true,
    });
    const csv = await bp.request.get(`${reportUrl}/download?format=csv`);
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain("not unique people");
    const pdf = await bp.request.get(`${reportUrl}/download?format=pdf`);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

    // The Creator withdraws their figures: the old report can no longer be opened or exported; a new version can
    await cp.goto(negUrl);
    await cp.getByRole("button", { name: "Stop sharing my figures" }).click();
    await expect(
      cp.getByRole("button", { name: "Share my figures again" }),
    ).toBeVisible();
    await bp.goto(reportUrl);
    await expect(
      bp.getByRole("heading", { name: "This report can no longer be opened" }),
    ).toBeVisible();
    expect(
      (await bp.request.get(`${reportUrl}/download?format=csv`)).status(),
    ).toBe(403);
    await bp.goto(`/brand/campaigns/${id}/reports`);
    await expect(bp.getByText("Figures withdrawn")).toBeVisible();
    await bp
      .getByRole("form", { name: "New report" })
      .getByLabel(/^Name/)
      .fill("Weekly results");
    await bp
      .getByRole("form", { name: "New report" })
      .getByRole("button", { name: "Create report" })
      .click();
    await expect(bp.getByText(/Report saved as version 2/)).toBeVisible();

    for (const p of [
      `/brand/campaigns/${id}/monitor`,
      `/brand/campaigns/${id}/reports`,
      bp
        .url()
        .replace(/^https?:\/\/[^/]+/, "")
        .split("?")[0],
    ])
      await overflowAndAxe(bp, p);
    await overflowAndAxe(cp, negUrl.replace(/^https?:\/\/[^/]+/, ""));
    for (const x of [a.ctx, b, r]) await x.close();
  });
});
