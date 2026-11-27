// M21 end to end on the real routes, against the local test stack (real PostgreSQL migrations, NOT Supabase).
// Named to sort after marketplace.spec.ts (shared stack database). The whole journey is manual, as approved for M21: nothing is
// posted to a platform and no AI provider is configured; reuse of Creator content is covered by tests/db/m21_rls.sql.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { seedUser, signedIn } from "./helpers";

test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 20_000 });
const unique = () => Math.random().toString(36).slice(2, 8);
const shots = "docs/development/evidence/m21";
const today = () => new Date().toISOString().slice(0, 10);
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

test.describe("M21 Brand content on real routes with the local test stack (not Supabase)", () => {
  test("anonymous visitors are sent to sign-in", async ({ page }) => {
    for (const p of [
      "/brand/content",
      "/brand/content/board",
      "/brand/content/calendar",
    ]) {
      await page.goto(p);
      await expect(page, p).toHaveURL(/\/login/);
    }
  });

  test("idea to published post with review, claims, checklist and results; assistant ideas; isolation", async ({
    browser,
    request,
  }) => {
    test.setTimeout(420_000);
    mkdirSync(shots, { recursive: true });
    const brand = await seedUser(
      request,
      `m21-${unique()}@example.com`,
      "Riya Shah",
      "brand",
      { mfa: true },
    );
    const other = await seedUser(
      request,
      `m21o-${unique()}@example.com`,
      "Other Owner",
      "brand",
      { mfa: true },
    );
    const b = await browser.newContext();
    await signedIn(b, brand);
    const bp = await b.newPage();
    const w = brand.workspace_id;
    await onboard(bp, w, "Coastline Hostels");

    // An account to post on (M14), then the Content area from the Brand navigation
    await bp.goto(`/brand/socials?w=${w}`);
    const acc = bp.getByRole("form", { name: "Add a social account" });
    await acc.getByLabel(/^Platform/).selectOption("instagram");
    await acc.getByLabel(/^Handle/).fill("coastlinehostels");
    await acc.getByRole("button", { name: "Add account" }).click();
    await expect(bp.getByText("coastlinehostels").first()).toBeVisible();
    await bp
      .getByRole("navigation", { name: "Brand" })
      .getByRole("link", { name: "Content" })
      .click();
    await expect(
      bp.getByRole("heading", { name: "Content", level: 1 }),
    ).toBeVisible();

    // Pillars and the target mix
    await bp
      .getByRole("navigation", { name: "Content" })
      .getByRole("link", { name: "Pillars" })
      .click();
    const pl = bp.getByRole("form", { name: "Add a pillar" });
    await pl.getByLabel(/^Name/).fill("Behind the scenes");
    await pl.getByLabel(/^Target share/).fill("60");
    await pl.getByRole("button", { name: "Add pillar" }).click();
    await expect(pl.getByText("Saved. Your mix adds up to 60%.")).toBeVisible();

    // Capture an idea and open it from the board
    await bp.goto(`/brand/content/board?w=${w}`);
    const nw = bp.getByRole("form", { name: "Add an idea" });
    await nw.getByLabel(/^Idea/).fill("Dorm tour reel");
    await nw.getByLabel(/^Pillar/).selectOption({ label: "Behind the scenes" });
    await nw.getByRole("button", { name: "Create and open" }).click();
    await expect(
      bp.getByRole("heading", { name: "Dorm tour reel", level: 1 }),
    ).toBeVisible();
    await bp.getByRole("button", { name: "Start drafting" }).click();
    await expect(bp.getByText("Moved to Drafting.")).toBeVisible();

    // Edit: versioned, with a claim that is not on the approved list
    const ed = bp.getByRole("form", { name: "Edit content" });
    await ed
      .getByLabel(/^Account/)
      .selectOption({ label: "Instagram @coastlinehostels" });
    await ed.getByLabel(/^Planned for/).fill(today());
    await ed.getByLabel(/^Hook/).fill("Where would you sleep for 600 rupees?");
    await ed
      .getByLabel(/^Caption/)
      .fill("Walk through our sea-view dorm. Breakfast included.");
    await ed.getByLabel(/^Claims made/).fill("Best hostel in Goa");
    await ed.getByRole("button", { name: "Save new version" }).click();
    await expect(ed.getByText("Saved as version 2.")).toBeVisible();
    await bp.reload();
    await expect(
      bp.getByText(/Not on your approved list: Best hostel in Goa/),
    ).toBeVisible();
    await bp.screenshot({
      path: `${shots}/editor-desktop.png`,
      fullPage: true,
    });

    // Review: the unlisted claim needs a reason
    await bp.getByRole("button", { name: "Send for review" }).click();
    await expect(bp.getByText("Moved to In review.")).toBeVisible();
    const rv = bp.getByRole("form", { name: "Review" });
    await rv.getByLabel(/^Decision/).selectOption("approved");
    await rv.getByRole("button", { name: "Submit review" }).click();
    await expect(
      rv.getByText(/Some claims are not on your approved list/).first(),
    ).toBeVisible();
    await rv
      .getByLabel(/^Note/)
      .fill("Backed by our 2026 guest survey; legal agreed.");
    await rv.getByRole("button", { name: "Submit review" }).click();
    await expect(bp.getByText(/Version 2 · approved/)).toBeVisible();
    await expect(bp.getByText(/Riya Shah ·/).first()).toBeVisible();

    // Schedule, then the publication checklist and manual publication
    await bp.getByRole("button", { name: "Schedule" }).click();
    await expect(bp.getByText("Moved to Scheduled.")).toBeVisible();
    await expect(bp.getByText(/3 steps left|4 steps left/)).toBeVisible();
    for (const label of [
      "Final copy matches",
      "Posting on the right account",
      "Links and tags checked",
      "Every claim is approved",
    ]) {
      await bp.getByRole("button", { name: new RegExp(label) }).click();
      await expect(
        bp.getByRole("button", { name: new RegExp(label) }),
      ).toHaveAttribute("aria-pressed", "true");
    }
    await bp.screenshot({
      path: `${shots}/publish-desktop.png`,
      fullPage: true,
    });
    const pub = bp.getByRole("form", { name: "Mark as published" });
    await pub
      .getByLabel(/^Link to the live post/)
      .fill("http://instagram.com/p/dorm");
    await pub.getByRole("button", { name: "Mark as published" }).click();
    await expect(
      pub.getByText("Paste the full https:// link to the live post."),
    ).toBeVisible();
    await pub
      .getByLabel(/^Link to the live post/)
      .fill("https://instagram.com/p/dorm");
    await pub.getByRole("button", { name: "Mark as published" }).click();
    await expect(bp.getByRole("heading", { name: "Live" })).toBeVisible();
    await expect(bp.getByRole("form", { name: "Edit content" })).toHaveCount(0);

    // Results with source and date; repeated readings replace, never add
    const res = bp.getByRole("form", { name: "Record a result" });
    await res.getByLabel(/^Metric/).selectOption("views");
    await res.getByLabel(/^Value/).fill("500");
    await res.getByRole("button", { name: "Record" }).click();
    await expect(
      res.getByText("Recorded with its source and date."),
    ).toBeVisible();
    await res.getByLabel(/^Metric/).selectOption("views");
    await res.getByLabel(/^Value/).fill("1200");
    await res.getByRole("button", { name: "Record" }).click();
    await expect(
      res.getByText("Recorded with its source and date."),
    ).toBeVisible();
    const itemUrl = bp
      .url()
      .replace(/^https?:\/\/[^/]+/, "")
      .split("#")[0];
    await bp.goto(`/brand/content/learning?w=${w}`);
    await expect(bp.getByText("1,200").first()).toBeVisible();
    await expect(bp.getByText("2,700")).toHaveCount(0);
    await bp.screenshot({
      path: `${shots}/performance-desktop.png`,
      fullPage: true,
    });

    // Calendar and overview
    await bp.goto(`/brand/content/calendar?w=${w}`);
    await expect(
      bp.getByRole("link", { name: /Dorm tour reel/ }),
    ).toBeVisible();
    await bp.screenshot({
      path: `${shots}/calendar-desktop.png`,
      fullPage: true,
    });

    // One product: the assistant drafts content ideas; a person approves; they land on the board as ideas
    await bp.goto(`/brand/assistant?w=${w}`);
    const start = bp.getByRole("form", { name: "Start a conversation" });
    await start
      .getByLabel(/^What do you want help with/)
      .selectOption("content");
    await start.getByRole("button", { name: "Start" }).click();
    await expect(
      bp.getByRole("heading", { name: "Content ideas", level: 1 }),
    ).toBeVisible();
    await bp.getByText(/What will be shared/).click();
    await expect(bp.locator(".ba-context pre")).toContainText(
      "Behind the scenes",
    );
    const man = bp.getByRole("form", { name: "Write a draft" });
    await expect(man.getByLabel(/^Draft type/)).toHaveValue("content_ideas");
    await man
      .getByLabel(/^Draft$/)
      .fill("Night market walk with guests\nBunk bed makeover");
    await man.getByRole("button", { name: "Save draft" }).click();
    await expect(
      man.getByText("Draft saved. Approve it when you are ready."),
    ).toBeVisible();
    await bp.reload();
    const draft = bp.getByRole("article", { name: "Content ideas draft" });
    const ap = draft.getByRole("form", { name: "Approve Content ideas" });
    await ap
      .getByLabel("I have reviewed this draft and want to apply it")
      .check();
    await ap
      .getByRole("button", { name: "Add these ideas to Content" })
      .click();
    await expect(draft.getByText(/2 ideas are in/)).toBeVisible();
    await bp.goto(`/brand/content/board?w=${w}`);
    const ideas = bp.getByRole("region", { name: /^Idea/ });
    await expect(
      ideas.getByRole("link", { name: "Night market walk with guests" }),
    ).toBeVisible();
    await expect(ideas.getByText("AI suggestion")).toHaveCount(0);
    await bp.screenshot({ path: `${shots}/board-desktop.png`, fullPage: true });

    // Brand home shows the content status
    await bp.goto(`/brand?w=${w}`);
    await expect(
      bp.getByRole("heading", { name: "Your own channels" }),
    ).toBeVisible();

    // Another Brand cannot open this content
    const o = await browser.newContext();
    await signedIn(o, other);
    const op = await o.newPage();
    await onboard(op, other.workspace_id, "Other Brand Co");
    const id = itemUrl.split("?")[0].split("/").pop();
    expect(
      (await op.goto(`/brand/content/${id}?w=${other.workspace_id}`))?.status(),
    ).toBe(404);
    await op.goto(`/brand/content/board?w=${other.workspace_id}`);
    await expect(op.getByText("Dorm tour reel")).toHaveCount(0);

    // Accessibility and overflow across the content screens
    for (const p of [
      "",
      "/board",
      "/calendar",
      "/pillars",
      "/reuse",
      "/learning",
    ])
      await overflowAndAxe(bp, `/brand/content${p}?w=${w}`);
    await overflowAndAxe(bp, itemUrl);
    await bp.setViewportSize({ width: 390, height: 844 });
    await bp.goto(`/brand/content/calendar?w=${w}`);
    await bp.screenshot({
      path: `${shots}/calendar-mobile.png`,
      fullPage: true,
    });
    await b.close();
    await o.close();
  });
});
