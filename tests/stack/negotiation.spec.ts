// Named to sort after marketplace.spec.ts: the stack database is shared, and the M10 suite first checks an empty marketplace.
import { expect, test, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { seedUser, signedIn } from "./helpers";

// M11 end to end on the real routes, against the local test stack (real PostgreSQL migrations, NOT Supabase).
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
  await rp.goto("/admin/marketplace");
  const row = rp.locator("li", {
    has: rp.locator(`input[name="id"][value="${brand.workspace_id}"]`),
  });
  await row.getByLabel("Reason").fill("Registration documents checked");
  await row.getByRole("button", { name: "Record" }).click();
  await expect(rp.getByText("Decision recorded.")).toBeVisible();
  await bp.goto(bp.url());
  const url = bp.url().split("?")[0];
  await bp.getByRole("button", { name: "Publish campaign" }).click();
  await expect(bp.getByText(/Sent to a reviewer/)).toBeVisible();
  await rp.goto("/admin/marketplace");
  const camp = rp.getByRole("listitem").filter({ hasText: title }).first();
  await camp.getByLabel("Reason").fill("Clear terms");
  await camp.getByRole("button", { name: "Record" }).click();
  await expect(rp.getByText("Decision recorded.")).toBeVisible();
  return { brand, b, bp, r, rp, id: url.split("/").pop()!, url };
}
const shots = "docs/development/evidence/m11";
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

test.describe("M11 real routes with the local test stack (not Supabase)", () => {
  test("anonymous visitors are sent to sign-in", async ({ page }) => {
    for (const p of [
      "/creator/applications",
      "/creator/invitations",
      "/creator/enquiries",
      "/creator/settings/applications",
      "/brand/inbox",
      "/admin/applications",
    ]) {
      await page.goto(p);
      await expect(page, p).toHaveURL(/\/login/);
    }
  });

  test("apply with screening and confirmation, clarification, selection, negotiation to the exact same version, invitations, blocking and moderated reports", async ({
    browser,
    request,
  }) => {
    test.setTimeout(420_000);
    mkdirSync(shots, { recursive: true });
    const title = `Travel kit videos ${unique()}`;
    const { b, bp, rp, r, id } = await liveCampaign(browser, request, title);
    // Brand: rules and screening. Unpaid custom work is refused (F36); fair questions are kept.
    await bp.goto(`/brand/campaigns/${id}/applications`);
    const rules = bp.getByRole("form", { name: "Application rules" });
    await rules.getByLabel(/Terms are negotiable/).check();
    await rules
      .getByLabel(/Screening questions/)
      .fill("* Create a video for us about our travel kit");
    await rules.getByRole("button", { name: "Save rules" }).click();
    await expect(
      rules
        .getByText(/cannot ask Creators to make new content for free/)
        .first(),
    ).toBeVisible();
    await rules
      .getByLabel(/Screening questions/)
      .fill(
        "* Which city are you based in?\nHave you made travel content before? (yes/no)",
      );
    await rules.getByRole("button", { name: "Save rules" }).click();
    await expect(bp.getByText("Application rules saved.")).toBeVisible();

    // Creator: check and apply, autosaved draft, confirmation and required answers (AC01, AC03)
    const a = await creator(browser, request, `asha.${unique()}`);
    const cp = a.page;
    await cp.goto(`/creator/marketplace/${id}`);
    await cp.getByRole("button", { name: "Check and apply" }).click();
    await expect(
      cp.getByRole("heading", { name: `Apply: ${title}` }),
    ).toBeVisible();
    await cp
      .getByLabel(/Why you, for this campaign/)
      .fill(
        "I film honest, practical travel videos on a budget, and a compact kit is exactly what my audience asks me about every week.",
      );
    await expect(cp.getByText(/Draft saved at/)).toBeVisible({
      timeout: 15_000,
    });
    await cp.reload();
    await expect(cp.getByLabel(/Why you, for this campaign/)).toHaveValue(
      /honest, practical travel videos/,
    );
    await cp.screenshot({ path: `${shots}/apply-desktop.png`, fullPage: true });
    await cp.getByRole("button", { name: "Send application" }).click();
    await expect(
      cp.getByText("Tick the confirmation box before sending.").first(),
    ).toBeVisible();
    await cp.getByLabel(/I have checked this application/).check();
    await cp.getByRole("button", { name: "Send application" }).click();
    await expect(
      cp.getByText("Answer every required screening question.").first(),
    ).toBeVisible();
    await expect(cp.getByLabel(/Why you, for this campaign/)).toHaveValue(
      /honest, practical/,
    ); // input kept
    await cp.getByLabel("Which city are you based in? (required)").fill("Pune");
    await cp
      .getByLabel(/Have you made travel content before/)
      .selectOption("yes");
    await cp.getByRole("button", { name: "Send application" }).click();
    await expect(
      cp.getByText(/Application sent\. You can still change it/),
    ).toBeVisible();
    await expect(
      cp.getByText("Submitted", { exact: true }).first(),
    ).toBeVisible();
    const appUrl = cp.url().split("?")[0];
    // one active application: going back to apply lands on the application (AC02 at the UI)
    await cp.goto(`/creator/marketplace/${id}/apply`);
    await expect(cp).toHaveURL(appUrl);

    // Brand: sees only what was shared, asks a question (locks), Creator answers, Brand selects (not an agreement)
    await bp.goto(`/brand/campaigns/${id}/applications`);
    await bp.getByRole("link", { name: "Asha Rao" }).click();
    await expect(bp.getByText(/honest, practical travel videos/)).toBeVisible();
    await expect(bp.getByText("Pune")).toBeVisible();
    await expect(bp.getByText(/ownership not verified/)).toBeVisible();
    const ask = bp.getByRole("form", { name: "Ask a question" });
    await ask.getByLabel(/^Question/).fill("Could you film in December?");
    await ask.getByRole("button", { name: "Ask" }).click();
    await expect(bp.getByText(/Question sent/)).toBeVisible();
    await cp.goto(appUrl);
    await expect(cp.getByText("Question from the Brand").first()).toBeVisible();
    const ans = cp.getByRole("form", { name: "Answer the question" });
    await ans.getByLabel(/Your answer/).fill("Yes, from the 10th to the 20th.");
    await ans.getByRole("button", { name: "Send answer" }).click();
    await expect(
      cp.getByText("Your answer: Yes, from the 10th to the 20th."),
    ).toBeVisible();
    await bp.reload();
    await expect(bp.getByText("Yes, from the 10th to the 20th.")).toBeVisible();
    const dec = bp.getByRole("form", { name: "Decision" });
    await dec.getByLabel(/^Decision/).selectOption("select");
    await dec.getByRole("button", { name: "Record decision" }).click();
    await expect(
      bp.getByText(/Selected\. This is not an agreement yet/),
    ).toBeVisible();
    await bp.screenshot({
      path: `${shots}/brand-application-desktop.png`,
      fullPage: true,
    });

    // Negotiation: proposal, counter-proposal resets confirmations, both confirm the exact current version (AC05)
    await cp.goto(appUrl);
    await expect(
      cp.getByText(/Nothing is binding until an agreement is accepted/),
    ).toBeVisible();
    await cp.getByRole("link", { name: "Open the negotiation" }).click();
    const prop = cp.getByRole("form", { name: "New proposal" });
    await prop.getByLabel("Compensation (money)").fill("5000");
    await prop.getByRole("button", { name: "Send proposal" }).click();
    await expect(cp.getByText(/Proposal sent/)).toBeVisible();
    const negUrl = cp.url().split("?")[0];
    const negId = negUrl.split("/").pop()!;
    await bp.goto(`/brand/negotiations/${negId}`);
    await expect(
      bp.getByRole("heading", { name: "Current proposal · version 1" }),
    ).toBeVisible();
    await bp.getByRole("button", { name: "Confirm version 1" }).click();
    await expect(
      bp.getByText("Tick the box to confirm this exact version."),
    ).toBeVisible();
    await bp
      .getByLabel("I confirm exactly version 1 as written above.")
      .check();
    await bp.getByRole("button", { name: "Confirm version 1" }).click();
    await expect(bp.getByText(/You confirmed this version/)).toBeVisible();
    // the Creator counters: version 2 resets the Brand's confirmation
    await cp.goto(negUrl);
    const counter = cp.getByRole("form", { name: "New proposal" });
    await counter.getByLabel("Compensation (money)").fill("4500");
    await counter.getByLabel("Revision rounds").fill("2");
    await counter.getByRole("button", { name: "Send proposal" }).click();
    await expect(cp.getByText(/Proposal sent/)).toBeVisible();
    await cp.reload();
    await expect(
      cp.getByText(/Changed from version 1: compensation, revisions/),
    ).toBeVisible();
    await expect(cp.getByText(/has not confirmed/).first()).toBeVisible();
    await cp
      .getByLabel("I confirm exactly version 2 as written above.")
      .check();
    await cp.getByRole("button", { name: "Confirm version 2" }).click();
    await expect(cp.getByText(/You confirmed this version/)).toBeVisible();
    await bp.goto(`/brand/negotiations/${negId}`);
    await bp
      .getByLabel("I confirm exactly version 2 as written above.")
      .check();
    await bp.getByRole("button", { name: "Confirm version 2" }).click();
    await expect(
      bp.getByText(/Both sides confirmed the same version/),
    ).toBeVisible();
    await expect(
      bp.getByText(/Nothing is binding until that agreement is accepted/),
    ).toBeVisible();
    const msg = bp.getByRole("form", { name: "Send a message" });
    await msg.getByLabel(/^Message/).fill("Thank you, the agreement follows.");
    await msg.getByRole("button", { name: "Send" }).click();
    await expect(bp.getByText("Sent.")).toBeVisible();
    await cp.goto(negUrl);
    await expect(
      cp.getByText("Ready for an agreement (not yet binding)").first(),
    ).toBeVisible();
    await expect(
      cp.getByText("Thank you, the agreement follows."),
    ).toBeVisible();
    await expect(cp.getByRole("form", { name: "New proposal" })).toHaveCount(0);
    await cp.screenshot({
      path: `${shots}/negotiation-desktop.png`,
      fullPage: true,
    });
    await cp.setViewportSize({ width: 390, height: 844 });
    await cp.screenshot({
      path: `${shots}/negotiation-mobile.png`,
      fullPage: true,
    });
    await cp.setViewportSize({ width: 1280, height: 800 });

    // Invitations: by published username only; interest opens a negotiation; block and report go to moderation
    const username = `fay${unique()}`;
    const c2 = await creator(browser, request, `fay.${unique()}`, username);
    await bp.goto(`/brand/campaigns/${id}/applications`);
    const inv = bp.getByRole("form", { name: "Invite a Creator" });
    await inv.getByLabel(/Creator username/).fill("nobody-here-x");
    await inv
      .getByLabel(/Why you are inviting them/)
      .fill(
        "We love your budget travel films and would like you to try our kit.",
      );
    await inv.getByRole("button", { name: "Send invitation" }).click();
    await expect(
      inv.getByText("No published Creator profile has that username.").first(),
    ).toBeVisible();
    await inv.getByLabel(/Creator username/).fill(username);
    await inv.getByRole("button", { name: "Send invitation" }).click();
    await expect(
      bp.getByText(/Invitation sent\. It expires in 14 days/),
    ).toBeVisible();
    const fp = c2.page;
    await fp.goto("/creator/invitations");
    await fp.getByRole("link", { name: title }).click();
    await expect(
      fp.getByText("We love your budget travel films"),
    ).toBeVisible();
    await fp.screenshot({
      path: `${shots}/invitation-desktop.png`,
      fullPage: true,
    });
    await fp.getByRole("button", { name: "I am interested" }).click();
    await expect(
      fp.getByText(/Interest sent\. This is not an agreement/),
    ).toBeVisible();
    await fp.goBack();
    await fp.reload();
    await fp.getByText("Report this invitation").click();
    const rep = fp.getByRole("form", { name: "Report this invitation" });
    await rep.getByLabel(/What is wrong/).selectOption("unpaid_custom_work");
    await rep.getByRole("button", { name: "Send report" }).click();
    await expect(
      fp.getByText(/Reported\. A reviewer will look at it/),
    ).toBeVisible();
    await fp.getByRole("button", { name: /^Block / }).click();
    await expect(fp.getByRole("button", { name: /^Unblock / })).toBeVisible();
    await fp.goto("/creator/settings/applications");
    await expect(fp.getByRole("button", { name: "Unblock" })).toBeVisible();
    await rp.goto("/admin/applications");
    const item = rp
      .getByRole("listitem")
      .filter({ hasText: "We love your budget travel films" })
      .first();
    await expect(item).toContainText("Asks for unpaid custom work");
    await item
      .getByLabel("Reason")
      .fill("Message is fine, no unpaid work requested");
    await item.getByLabel("Decision").selectOption("dismissed");
    await item.getByRole("button", { name: "Record" }).click();
    await expect(rp.getByText("Decision recorded.")).toBeVisible();
    // blocked: the Brand cannot send this Creator an enquiry
    await bp.goto("/brand/inbox");
    const enq = bp.getByRole("form", { name: "Send an enquiry" });
    await enq.getByLabel(/Creator username/).fill(username);
    await enq
      .getByLabel(/Your question/)
      .fill("Are you available for a shoot in January next year?");
    await enq.getByRole("button", { name: "Send enquiry" }).click();
    await expect(
      bp.getByText(/not accepting messages from your Brand/),
    ).toBeVisible();
    await bp.screenshot({
      path: `${shots}/brand-inbox-desktop.png`,
      fullPage: true,
    });

    // Creator overview
    await cp.goto("/creator/applications");
    await expect(
      cp.getByRole("heading", { name: "Applications and invitations" }),
    ).toBeVisible();
    await cp.screenshot({
      path: `${shots}/applications-desktop.png`,
      fullPage: true,
    });
    await cp.setViewportSize({ width: 390, height: 844 });
    await cp.screenshot({
      path: `${shots}/applications-mobile.png`,
      fullPage: true,
    });

    // accessibility and overflow on every M11 page with real data
    for (const [pg, p] of [
      [cp, "/creator/applications"],
      [cp, appUrl.replace(/^https?:\/\/[^/]+/, "")],
      [cp, negUrl.replace(/^https?:\/\/[^/]+/, "")],
      [cp, "/creator/enquiries"],
      [fp, "/creator/invitations"],
      [fp, "/creator/settings/applications"],
      [bp, `/brand/campaigns/${id}/applications`],
      [bp, `/brand/negotiations/${negId}`],
      [bp, "/brand/inbox"],
      [rp, "/admin/applications"],
    ] as const)
      await overflowAndAxe(pg, p);
    for (const x of [a.ctx, c2.ctx, b, r]) await x.close();
  });

  test("edits create versions before review, withdrawal needs confirmation, one reapplication after withdrawal, then refused", async ({
    browser,
    request,
  }) => {
    test.setTimeout(300_000);
    const title = `Weekend kit ${unique()}`;
    const { b, r, id } = await liveCampaign(browser, request, title);
    const a = await creator(browser, request, `ravi.${unique()}`);
    const cp = a.page;
    const sendApp = async () => {
      await cp.goto(`/creator/marketplace/${id}/apply`);
      await cp
        .getByLabel(/Why you, for this campaign/)
        .fill(
          "I review travel gear on a budget and my followers trust my honest, side-by-side comparisons of small kits.",
        );
      await cp.getByLabel(/I have checked this application/).check();
      await cp.getByRole("button", { name: "Send application" }).click();
      await expect(
        cp.getByText(/Application sent\. You can still/),
      ).toBeVisible();
    };
    await sendApp();
    // edit before review creates version 2
    await cp.getByText("Edit before review").click();
    const ed = cp.getByRole("form", { name: "Edit application" });
    await ed
      .getByLabel(/Why you, for this campaign/)
      .fill(
        "Updated: I review travel gear on a budget, with honest side-by-side comparisons my followers rely on.",
      );
    await ed.getByLabel(/Send these changes/).check();
    await ed.getByRole("button", { name: "Send changes" }).click();
    await expect(cp.getByText(/Sent as a new version/)).toBeVisible();
    await cp.reload();
    await expect(cp.getByText(/Version 2/).first()).toBeVisible();
    // withdrawal needs the box
    await cp.getByText("Withdraw", { exact: true }).click();
    const wd = cp.getByRole("form", { name: "Withdraw the application" });
    await wd.getByRole("button", { name: "Withdraw application" }).click();
    await expect(
      wd.getByText("Tick the box to confirm the withdrawal.").first(),
    ).toBeVisible();
    await wd.getByLabel("I want to withdraw this application.").check();
    await wd.getByRole("button", { name: "Withdraw application" }).click();
    await expect(cp.getByText(/Withdrawn\. The Brand was told/)).toBeVisible();
    // one reapplication after your own withdrawal is allowed, then no more
    await cp.getByRole("link", { name: "Apply again" }).click();
    await expect(cp.getByText(/You applied before/)).toBeVisible();
    await cp
      .getByLabel(/Why you, for this campaign/)
      .fill(
        "Reapplying: I review travel gear on a budget with honest, side-by-side comparisons of small kits.",
      );
    await cp.getByLabel(/I have checked this application/).check();
    await cp.getByRole("button", { name: "Send application" }).click();
    await expect(
      cp.getByText(/Application sent\. You can still/),
    ).toBeVisible();
    await cp.getByText("Withdraw", { exact: true }).click();
    const wd2 = cp.getByRole("form", { name: "Withdraw the application" });
    await wd2.getByLabel("I want to withdraw this application.").check();
    await wd2.getByRole("button", { name: "Withdraw application" }).click();
    await expect(cp.getByText(/Withdrawn/).first()).toBeVisible();
    await expect(cp.getByRole("link", { name: "Apply again" })).toHaveCount(0);
    await cp.goto(`/creator/marketplace/${id}/apply`);
    await cp
      .getByLabel(/Why you, for this campaign/)
      .fill(
        "A third try that the rules do not allow for this campaign, so it must be refused.",
      );
    await cp.getByLabel(/I have checked this application/).check();
    await cp.getByRole("button", { name: "Send application" }).click();
    await expect(
      cp.getByText("Reapplying is not allowed for this campaign."),
    ).toBeVisible();
    for (const x of [a.ctx, b, r]) await x.close();
  });
});
