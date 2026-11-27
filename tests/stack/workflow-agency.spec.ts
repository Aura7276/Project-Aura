// M23 end to end on the real routes, against the local test stack (real PostgreSQL migrations, NOT Supabase).
// An Agency is created, verified by a platform reviewer, invited by link, granted limited access by a Brand, works inside the
// Brand's workspace (with the banner, logged), is refused outside its grant, and loses access the moment the Brand ends it.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { seedUser, signedIn } from "./helpers";

test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 20_000 });
const unique = () => Math.random().toString(36).slice(2, 8);
const shots = "docs/development/evidence/m23";
async function overflowAndAxe(pg: Page, p: string) {
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
async function onboard(bp: Page, w: string, name: string) {
  await bp.goto(`/brand?w=${w}`);
  const basics = bp.getByRole("form", { name: "Business basics" });
  await basics.getByLabel(/^Brand name/).fill(name);
  await basics.getByLabel(/^Type of business/).selectOption("d2c");
  await basics.getByLabel(/^Industry/).fill("Travel");
  await basics.getByRole("button", { name: "Continue" }).click();
  const obj = bp.getByRole("form", { name: "Objective and stage" });
  await obj.getByLabel(/^Primary objective/).selectOption("conversion");
  await obj.getByRole("button", { name: "Continue" }).click();
  const cust = bp.getByRole("form", { name: "Customers and products" });
  await cust.getByLabel(/^Your main product or service/).fill("Dorm bed");
  await cust.getByLabel(/^Your main customer group/).fill("Budget backpackers");
  await cust.getByRole("button", { name: "Save and continue" }).click();
  await expect(
    bp.getByRole("heading", { name: "Set a first goal" }),
  ).toBeVisible();
  await bp.getByRole("link", { name: "Skip for now" }).click();
  await expect(
    bp.getByRole("heading", { name: "Which Creators suit you?" }),
  ).toBeVisible();
  await bp.getByRole("link", { name: "Skip for now" }).click();
  await bp.getByRole("button", { name: "Finish setup" }).click();
  await expect(bp.getByRole("heading", { name, level: 1 })).toBeVisible();
}

test.describe("M23 Agency Studio on real routes with the local test stack (not Supabase)", () => {
  test("anonymous visitors are sent to sign-in", async ({ page }) => {
    for (const p of [
      "/agency",
      "/agency/clients",
      "/brand/agencies",
      "/creator/agencies",
    ]) {
      await page.goto(p);
      await expect(page, p).toHaveURL(/\/login/);
    }
  });

  test("create and verify an Agency, client-granted access, working for a client, approvals, fees, narrowing and ending access", async ({
    browser,
    request,
  }) => {
    test.setTimeout(480_000);
    mkdirSync(shots, { recursive: true });
    const owner = await seedUser(
      request,
      `m23-${unique()}@example.com`,
      "Kiran Mehta",
      "creator",
      { mfa: true },
    );
    const reviewer = await seedUser(
      request,
      `rev23-${unique()}@example.com`,
      "Platform Reviewer",
      "creator",
      { admin: true },
    );
    const brand = await seedUser(
      request,
      `m23b-${unique()}@example.com`,
      "Riya Shah",
      "brand",
      { mfa: true },
    );
    const ag = await browser.newContext();
    await signedIn(ag, owner);
    const ap = await ag.newPage();
    const bc = await browser.newContext();
    await signedIn(bc, brand);
    const bp = await bc.newPage();
    const w = brand.workspace_id;
    await onboard(bp, w, "Coastline Hostels");

    // Create the Agency workspace (MFA), complete the profile, submit verification
    await ap.goto("/workspaces");
    await ap.getByLabel("Workspace type").selectOption("agency");
    await ap.getByLabel("Workspace name").fill("Talent Works");
    await ap.getByRole("button", { name: "Create workspace" }).click();
    await ap.getByRole("link", { name: "Open Agency Studio" }).click();
    await expect(
      ap.getByRole("heading", { name: "Agency Studio", level: 1 }),
    ).toBeVisible();
    await expect(
      ap.getByText(/Verify your Agency to invite clients/),
    ).toBeVisible();
    const aw = new URL(ap.url()).searchParams.get("w") ?? "";
    await ap.goto(`/agency/profile?w=${aw}`);
    const prof = ap.getByRole("form", { name: "Agency profile" });
    await prof.getByLabel(/^Registered business name/).fill("Talent Works LLP");
    await prof.getByLabel("Talent management").check();
    await prof.getByLabel("Campaign management").check();
    await prof.getByRole("button", { name: "Save profile" }).click();
    await expect(prof.getByText("Agency profile saved.")).toBeVisible();
    const ver = ap.getByRole("form", { name: "Verification" });
    await ver.getByLabel(/^Registration$/).selectOption("llp");
    await ver.getByLabel(/^Registration number/).fill("AAB-1234");
    await ver.getByLabel(/^Registered address/).fill("12 MG Road, Bengaluru");
    await ver.getByLabel(/^Authorised representative/).fill("Kiran Mehta");
    await ver
      .getByLabel(/^Evidence links/)
      .fill("https://docs.example/llp-certificate.pdf");
    await ver.getByLabel(/I confirm I am authorised/).check();
    await ver
      .getByRole("button", { name: "Save and submit for review" })
      .click();
    await expect(ap.getByText("With a reviewer")).toBeVisible();

    // A platform reviewer verifies it
    const rc = await browser.newContext();
    await signedIn(rc, reviewer);
    const rp = await rc.newPage();
    await rp.goto("/admin/agencies");
    const dec = rp.getByRole("form", { name: "Decide on Talent Works" });
    await dec.getByLabel(/^Decision/).selectOption("verified");
    await dec.getByRole("button", { name: "Record decision" }).click();
    await expect(rp.getByText("No Agencies waiting for review.")).toBeVisible();

    // Invite the Brand by private link, asking for view, content and campaigns
    await ap.goto(`/agency/clients?w=${aw}`);
    const inv = ap.getByRole("form", { name: "Invite a client" });
    await inv.getByLabel(/^Client type/).selectOption("brand");
    await inv.getByLabel(/^Client name/).fill("Coastline Hostels");
    await inv.getByRole("checkbox", { name: /^Content/ }).check();
    await inv.getByRole("checkbox", { name: /^Campaigns/ }).check();
    await inv
      .getByLabel(/^Message to the client/)
      .fill("We will run your content calendar.");
    await inv.getByRole("button", { name: "Create invitation link" }).click();
    const link = (await inv.locator(".pf-secret code").textContent()) ?? "";
    expect(link).toMatch(/\/agency-invite\/[0-9a-f]{64}$/);
    const invitePath = link.replace(/^https?:\/\/[^/]+/, "");

    // The Brand grants less than asked: view and content only, for 3 months
    await bp.goto(invitePath);
    await expect(
      bp.getByRole("heading", {
        name: "Talent Works would like to work for you",
      }),
    ).toBeVisible();
    await overflowAndAxe(bp, invitePath);
    const grant = bp.getByRole("form", { name: "Grant Agency access" });
    await grant.getByRole("checkbox", { name: /^Campaigns/ }).uncheck();
    await grant.getByLabel(/^For how long/).selectOption("3");
    await grant.getByRole("button", { name: "Grant access" }).click();
    await expect(
      grant.getByText("Tick the box to confirm.").first(),
    ).toBeVisible();
    await grant.getByLabel("I understand what I am allowing").check();
    await grant.getByRole("button", { name: "Grant access" }).click();
    await expect(
      bp.getByRole("heading", { name: "Agencies", level: 1 }),
    ).toBeVisible();
    await expect(bp.getByText(/Access granted/)).toBeVisible();
    await bp.screenshot({
      path: `${shots}/client-access-desktop.png`,
      fullPage: true,
    });

    // The Agency works inside the Brand's workspace with a clear banner
    await ap.goto(`/agency?w=${aw}`);
    await expect(
      ap.getByRole("link", { name: "Coastline Hostels" }),
    ).toBeVisible();
    await ap.screenshot({
      path: `${shots}/dashboard-desktop.png`,
      fullPage: true,
    });
    await ap.getByRole("button", { name: "Work for this client" }).click();
    const banner = ap.getByRole("region", { name: "Working for a client" });
    await expect(banner).toContainText(
      "Working for Coastline Hostels as Talent Works",
    );
    await ap
      .getByRole("navigation", { name: "Brand" })
      .getByRole("link", { name: "Content" })
      .click();
    const idea = ap.getByRole("form", { name: "Add an idea" });
    await idea.getByLabel(/^Idea/).fill("Monsoon stay reel");
    await idea.getByRole("button", { name: "Add idea" }).click();
    await expect(idea.getByText("Idea added.")).toBeVisible();
    await ap.screenshot({
      path: `${shots}/working-for-desktop.png`,
      fullPage: true,
    });
    // Outside the grant: the assistant (never part of "view") and the client's own Agency settings
    expect((await ap.goto(`/brand/assistant?w=${w}`))?.status()).toBe(404);
    expect((await ap.goto(`/brand/agencies?w=${w}`))?.status()).toBe(404);
    await ap.goto(`/brand/content?w=${w}`);
    await ap.getByRole("button", { name: "Back to Agency Studio" }).click();
    await expect(
      ap.getByRole("heading", { name: "Agency Studio", level: 1 }),
    ).toBeVisible();

    // Two separate approvals: the Agency's internal review never approves for the client
    await ap.goto(`/agency/approvals?w=${aw}`);
    const req = ap.getByRole("form", { name: "Ask a client to approve" });
    await req
      .getByLabel(/^What needs approval/)
      .fill("Approve the monsoon content plan");
    await req.getByLabel(/^Link inside AURA/).fill("/brand/content/board");
    await req.getByRole("button", { name: "Create request" }).click();
    await expect(req.getByText(/Request created/)).toBeVisible();
    await ap.reload();
    const ir = ap.getByRole("form", {
      name: "Internal review of Approve the monsoon content plan",
    });
    await ir.getByLabel(/^Internal decision/).selectOption("approved");
    await ir.getByRole("button", { name: "Save internal review" }).click();
    await expect(ap.getByText(/Agency review: Approved/)).toBeVisible();
    await ap.reload();
    await expect(ap.getByText("Client decision: Waiting")).toBeVisible();

    // An Agency fee, kept apart from client spend
    await ap.goto(`/agency/fees?w=${aw}`);
    const fee = ap.getByRole("form", { name: "Record a fee" });
    await fee.getByLabel(/^Type/).selectOption("retainer");
    await fee.getByLabel(/^Description/).fill("Monthly content retainer");
    await fee.getByLabel(/^Amount/).fill("45000");
    await fee.getByLabel(/^Status/).selectOption("invoiced");
    await fee.getByRole("button", { name: "Save fee" }).click();
    await expect(fee.getByText(/Fee saved/)).toBeVisible();

    // The Brand sees the request, the fee and every action taken in its name; it decides for itself
    await bp.goto(`/brand/agencies?w=${w}`);
    const cd = bp.getByRole("form", {
      name: "Decide on Approve the monsoon content plan",
    });
    await cd.getByLabel(/^Decision/).selectOption("approved");
    await cd.getByRole("button", { name: "Record my decision" }).click();
    await expect(bp.getByText("You approved")).toBeVisible();
    await bp.reload();
    await expect(
      bp.getByText("Retainer: Monthly content retainer"),
    ).toBeVisible();
    await bp.getByText(/Everything done in your name/).click();
    await expect(bp.getByText(/Content · create/).first()).toBeVisible();
    await expect(bp.getByText(/Kiran Mehta/).first()).toBeVisible();

    // The Brand narrows access to view only: content changes stop at once
    const ch = bp.getByRole("form", { name: "Change access for Talent Works" });
    await ch.getByRole("checkbox", { name: /^Content/ }).uncheck();
    await ch.getByRole("button", { name: "Update access" }).click();
    await expect(
      ch.getByText("Access updated. It applies immediately."),
    ).toBeVisible();
    await ap.goto(`/agency?w=${aw}`);
    await ap.getByRole("button", { name: "Work for this client" }).click();
    await ap.goto(`/brand/content?w=${w}`);
    const idea2 = ap.getByRole("form", { name: "Add an idea" });
    await idea2.getByLabel(/^Idea/).fill("Blocked idea");
    await idea2.getByRole("button", { name: "Add idea" }).click();
    await expect(
      idea2.getByText(/You need to be an owner or admin|do not have access/),
    ).toBeVisible();

    // The Brand ends access: the Agency is out immediately; the record stays
    await bp.reload();
    const end = bp.getByRole("form", { name: "End access for Talent Works" });
    await end.getByLabel("End all access immediately").check();
    await end.getByRole("button", { name: "End access now" }).click();
    await expect(
      bp.getByRole("heading", { name: "Past Agencies" }),
    ).toBeVisible();
    await ap.goto(`/brand/content?w=${w}`);
    await expect(ap).toHaveURL(/\/workspaces/);
    await ap.goto(`/agency/clients?w=${aw}`);
    await expect(ap.getByText(/Ended .* by client/)).toBeVisible();

    // Accessibility and overflow across Agency Studio and the client page
    for (const p of [
      "",
      "/clients",
      "/approvals",
      "/fees",
      "/safeguards",
      "/team",
      "/activity",
      "/profile",
    ])
      await overflowAndAxe(ap, `/agency${p}?w=${aw}`);
    await overflowAndAxe(bp, `/brand/agencies?w=${w}`);
    await ap.setViewportSize({ width: 390, height: 844 });
    await ap.goto(`/agency?w=${aw}`);
    await ap.screenshot({
      path: `${shots}/dashboard-mobile.png`,
      fullPage: true,
    });
    await ag.close();
    await bc.close();
    await rc.close();
  });
});
