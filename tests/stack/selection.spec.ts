// M18 end to end on the real routes, against the local test stack (real PostgreSQL migrations, NOT Supabase).
// Named to sort after marketplace.spec.ts: the stack database is shared and the M10 suite first checks an empty marketplace.
import { expect, test, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { seedUser, signedIn, verifyBrand } from "./helpers";

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
const shots = "docs/development/evidence/m18";
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

test.describe("M18 real routes with the local test stack (not Supabase)", () => {
  test("inbox, comparison, private notes, bulk review, 72-hour holds against capacity, acceptance and the M12 hand-off", async ({
    browser,
    request,
  }) => {
    test.setTimeout(480_000);
    mkdirSync(shots, { recursive: true });
    const title = `Rooftop reels ${unique()}`;
    const { b, bp, r, id } = await liveCampaign(browser, request, title);
    // one place only
    await bp.goto(`/brand/campaigns/${id}/build?step=deliverables`);
    await bp
      .getByRole("form", { name: "Deliverables" })
      .getByLabel(/^Number of positions/)
      .fill("1");
    await bp
      .getByRole("form", { name: "Deliverables" })
      .getByRole("button", { name: "Save and continue" })
      .click();
    await expect(
      bp.getByRole("form", { name: "Compensation and rights" }),
    ).toBeVisible();
    await bp.goto(`/brand/campaigns/${id}/build?step=review`);
    await bp.getByRole("button", { name: "Publish changes" }).click();
    await expect(bp.getByText(/Published\./)).toBeVisible();

    const pitch =
      "I film honest, practical travel videos on a budget and my audience asks me about kits like yours every week.";
    const a = await creator(browser, request, `asha.${unique()}`);
    const aUrl = await applyTo(a.page, id, pitch);
    const f = await creator(browser, request, `fay.${unique()}`);
    await applyTo(
      f.page,
      id,
      "Rooftop cafes are my favourite subject; I have filmed twenty of them in Goa and Mumbai this year.",
    );
    const g = await creator(browser, request, `gia.${unique()}`);
    await applyTo(
      g.page,
      id,
      "I make short UGC clips for hostels and cafes, and I can deliver vertical and square versions quickly.",
    );

    // Inbox: capacity, views, compare two, bulk-reject one with feedback
    await bp.goto(`/brand/campaigns/${id}/applications`);
    await expect(bp.getByText(/0 of 1 places taken or held/)).toBeVisible();
    const rows = bp.locator(".sl-row");
    await expect(rows).toHaveCount(3);
    await rows.nth(0).getByRole("checkbox").check();
    await rows.nth(1).getByRole("checkbox").check();
    await bp.screenshot({ path: `${shots}/inbox-desktop.png`, fullPage: true });
    await bp.getByRole("button", { name: "Compare chosen (2 to 4)" }).click();
    await expect(
      bp.getByRole("heading", { name: "Compare candidates" }),
    ).toBeVisible();
    const table = bp.locator("table.sl-compare");
    await expect(
      table.getByRole("rowheader", { name: "Mandatory requirements" }),
    ).toBeVisible();
    await expect(table).toContainText("All met");
    await expect(table).not.toContainText(/score|rank/i);
    await bp.screenshot({
      path: `${shots}/compare-desktop.png`,
      fullPage: true,
    });
    await bp.goto(`/brand/campaigns/${id}/applications`);
    await rows.nth(2).getByRole("checkbox").check();
    await bp.getByLabel("Action for chosen applicants").selectOption("reject");
    await bp
      .getByLabel(/Feedback for Creators who are not selected/)
      .fill("We chose a creator with rooftop experience this time.");
    await bp.getByRole("button", { name: "Apply" }).click();
    await expect(bp.getByText(/Done for 1/)).toBeVisible();

    // Candidate: private note and tags; a 72-hour hold takes the only place
    await bp.goto(`/brand/campaigns/${id}/applications?view=all`);
    const aRow = bp
      .locator(".sl-row")
      .filter({ hasText: pitch.slice(0, 0) })
      .first();
    await aRow.getByRole("link").first().click();
    await expect(bp.getByText(/honest, practical travel videos/)).toBeVisible();
    const note = bp.getByRole("form", { name: "Add a note" });
    await note
      .getByLabel(/^Note/)
      .fill("Strong portfolio; check December dates");
    await note.getByLabel(/^Tags/).fill("strong fit, check dates");
    await note.getByRole("button", { name: "Save note" }).click();
    await expect(
      bp.getByText("Strong portfolio; check December dates"),
    ).toBeVisible();
    const offer = bp.getByRole("form", { name: "Offer a place" });
    await offer
      .getByLabel(/^Message to the Creator/)
      .fill("We loved your pitch.");
    await offer
      .getByRole("button", { name: "Offer a place (72-hour hold)" })
      .click();
    await expect(bp.getByText(/Held until/).first()).toBeVisible();
    await bp.screenshot({
      path: `${shots}/candidate-desktop.png`,
      fullPage: true,
    });
    await bp.goto(`/brand/campaigns/${id}/applications`);
    await expect(bp.getByText(/1 of 1 places taken or held/)).toBeVisible();
    // the other candidate cannot be offered the same place
    await bp.goto(`/brand/campaigns/${id}/applications?view=shortlist`);
    await bp.goto(`/brand/campaigns/${id}/applications?view=new`);
    await bp.locator(".sl-row").first().getByRole("link").first().click();
    await bp
      .getByRole("form", { name: "Offer a place" })
      .getByRole("button", { name: "Offer a place (72-hour hold)" })
      .click();
    await expect(
      bp.getByText(/Every place is already taken or held/),
    ).toBeVisible();

    // Creator: the offer (not an agreement), the note never shows, accept → negotiation
    const cp = a.page;
    await cp.goto(aUrl);
    await expect(
      cp.getByRole("heading", { name: "You are offered a place" }),
    ).toBeVisible();
    await expect(cp.getByText("“We loved your pitch.”")).toBeVisible();
    await expect(cp.locator("#main")).not.toContainText(
      /Strong portfolio|strong fit/,
    );
    await cp.screenshot({ path: `${shots}/offer-desktop.png`, fullPage: true });
    await overflowAndAxe(cp, aUrl.replace(/^https?:\/\/[^/]+/, ""));
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

    // Hand-off: one project — the agreed proposal opens the M12 collaboration workspace for both sides
    await bp.reload();
    await expect(
      bp.getByText(/Your collaboration workspace is ready/),
    ).toBeVisible();
    await bp
      .getByRole("link", { name: "open the collaboration workspace" })
      .click();
    await expect(bp).toHaveURL(/\/collaborations\//);
    await expect(bp.locator("main").first()).toContainText(title);
    await expect(bp.locator("main").first()).toContainText(
      /Agreement pending/i,
    );
    await bp.screenshot({
      path: `${shots}/handoff-desktop.png`,
      fullPage: true,
    });
    await cp.goto(negUrl);
    await expect(
      cp.getByRole("link", { name: "open the collaboration workspace" }),
    ).toBeVisible();

    for (const p of [
      `/brand/campaigns/${id}/applications`,
      `/brand/campaigns/${id}/applications?view=selected`,
    ])
      await overflowAndAxe(bp, p);
    for (const x of [a.ctx, f.ctx, g.ctx, b, r]) await x.close();
  });
});
