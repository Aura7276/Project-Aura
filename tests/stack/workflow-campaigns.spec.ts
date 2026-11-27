// M17 end to end on the real routes, against the local test stack (real PostgreSQL migrations, NOT Supabase).
// Named to sort after marketplace.spec.ts: the stack database is shared and the M10 suite first checks an empty marketplace.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { seedUser, signedIn, verifyBrand } from "./helpers";

test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 20_000 });
const unique = () => Math.random().toString(36).slice(2, 8);
const later = (d: number) =>
  new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const shots = "docs/development/evidence/m17";
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
              .slice(0, 5)
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

test.describe("M17 real routes with the local test stack (not Supabase)", () => {
  test("rollout, the six-step builder, publication, management, duplicate, archive, preview and change history", async ({
    browser,
    request,
  }) => {
    test.setTimeout(420_000);
    mkdirSync(shots, { recursive: true });
    const brand = await seedUser(
      request,
      `m17-${unique()}@example.com`,
      "Riya Shah",
      "brand",
      { mfa: true },
    );
    const reviewer = await seedUser(
      request,
      `rev17-${unique()}@example.com`,
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
    const w = brand.workspace_id;
    await verifyBrand(bp, rp, w);

    // Rollout (R2): events are draft-only
    await bp.goto(`/brand/campaigns?w=${w}`);
    await expect(
      bp.getByRole("heading", { name: "Your campaigns" }),
    ).toBeVisible();
    const start = bp.getByRole("form", { name: "Start a campaign" });
    await expect(
      start
        .getByLabel("Type")
        .locator("option", { hasText: "Events (draft only, opens later)" }),
    ).toHaveCount(1);
    await start.getByLabel("Type").selectOption("event");
    await start.getByLabel("Working title").fill("Opening night party");
    await start.getByRole("button", { name: "Create draft" }).click();
    await expect(
      bp.getByRole("heading", { name: "Opening night party" }),
    ).toBeVisible();
    const eventUrl = bp.url().split("?")[0];
    await bp.goto(`${eventUrl}/build?step=review&w=${w}`);
    await expect(
      bp.getByText(/This campaign type opens later/).first(),
    ).toBeVisible();
    await expect(
      bp.getByRole("button", { name: "Publish campaign" }),
    ).toBeDisabled();

    // Builder: objective and plan, brief, deliverables, compensation, eligibility, preview and publish (R3–R6)
    await bp.goto(`/brand/campaigns?w=${w}`);
    await start.getByLabel("Type").selectOption("ugc");
    await start.getByLabel("Working title").fill("Travel kit unboxing videos");
    await start.getByRole("button", { name: "Create draft" }).click();
    await expect(
      bp.getByRole("heading", { name: "Travel kit unboxing videos" }),
    ).toBeVisible();
    const id = bp.url().split("?")[0].split("/").pop()!;
    await bp.getByRole("link", { name: "Builder" }).click();
    const obj = bp.getByRole("form", { name: "Objective and audience" });
    await obj.getByLabel(/^Objective/).selectOption("content");
    await obj.getByLabel(/^How you will measure it/).fill("Usable videos");
    await obj.getByLabel(/^Target/).fill("6");
    await obj
      .getByLabel(/^Milestones/)
      .fill(`${later(7)} Brief approved\n${later(21)} First drafts due`);
    await bp.screenshot({
      path: `${shots}/builder-objective-desktop.png`,
      fullPage: true,
    });
    await obj.getByRole("button", { name: "Save and continue" }).click();
    const brief = bp.getByRole("form", { name: "Brief" });
    await expect(brief.getByLabel(/^Brief/)).toHaveValue(
      /Brand Co is looking for Creators to help with content for our channels\./,
    );
    await brief
      .getByLabel(/^Summary \(shown on cards\)/)
      .fill("Short unboxing videos of our travel kit, filmed your way.");
    await brief
      .getByLabel(/^Brief/)
      .fill(
        "Show what is inside our compact travel kit and how you would use it on a weekend trip, in your own words and style.",
      );
    await brief.getByLabel(/^Applications close on/).fill(later(20));
    await brief.getByRole("button", { name: "Save and continue" }).click();
    const del = bp.getByRole("form", { name: "Deliverables" });
    await del
      .getByLabel(/^Deliverables, one per line/)
      .fill("2 x Video on Instagram");
    await del.getByLabel(/^Number of positions/).fill("2");
    await del.getByRole("button", { name: "Save and continue" }).click();
    const comp = bp.getByRole("form", { name: "Compensation and rights" });
    await comp.getByLabel(/^Money/).selectOption("fixed");
    await comp.getByLabel(/^Amount \(or lower end\)/).fill("3000");
    await comp.getByLabel(/^Usage rights \(months\)/).fill("6");
    await comp
      .getByLabel(/Where you will use the content/)
      .fill("organic, website");
    await comp.getByRole("button", { name: "Save and continue" }).click();
    await bp
      .getByRole("form", { name: "Eligibility" })
      .getByRole("button", { name: "Save and continue" })
      .click();
    await expect(
      bp.getByRole("heading", { name: "Ready to publish?" }),
    ).toBeVisible();
    await expect(bp.getByText("Every required term is complete")).toBeVisible();
    const preview = bp.getByRole("article", { name: "Creator preview" });
    await expect(preview.getByText("Money: ₹3,000")).toBeVisible();
    await expect(preview.getByText(/2 × Video|2 x Video/)).toBeVisible();
    await expect(preview).not.toContainText("Usable videos");
    await bp.screenshot({
      path: `${shots}/builder-review-desktop.png`,
      fullPage: true,
    });
    await bp.getByRole("button", { name: "Publish campaign" }).click();
    await expect(bp.getByText(/Sent to a reviewer/)).toBeVisible();
    await rp.goto("/admin/marketplace");
    const camp = rp
      .getByRole("listitem")
      .filter({ hasText: "Travel kit unboxing videos" })
      .first();
    await camp.getByLabel("Reason").fill("Clear terms");
    await camp.getByRole("button", { name: "Record" }).click();
    await expect(rp.getByText("Decision recorded.")).toBeVisible();

    // Management: live, open places, next milestone; duplicate (idempotent) and archive
    await bp.goto(`/brand/campaigns?w=${w}`);
    const row = bp
      .locator(".cp-row")
      .filter({ hasText: "Travel kit unboxing videos" })
      .first();
    await expect(row.getByText("Live", { exact: true })).toBeVisible();
    await expect(row.getByText(/Next: Brief approved/)).toBeVisible();
    await expect(row.locator(".cp-nums")).toContainText("Open places2");
    await bp.screenshot({
      path: `${shots}/campaigns-desktop.png`,
      fullPage: true,
    });
    await row.getByRole("button", { name: "Duplicate" }).click();
    await expect(bp.getByText(/Copied as a new private draft/)).toBeVisible();
    await expect(
      bp.getByRole("heading", { name: "Copy of Travel kit unboxing videos" }),
    ).toBeVisible();
    await bp.goto(`/brand/campaigns?w=${w}&filter=draft`);
    const copy = bp
      .locator(".cp-row")
      .filter({ hasText: "Copy of Travel kit unboxing videos" });
    await expect(copy).toHaveCount(1);
    await copy.getByRole("button", { name: "Archive" }).click();
    await expect(copy).toHaveCount(0);
    await bp.goto(`/brand/campaigns?w=${w}&filter=archived`);
    await expect(
      bp.locator(".cp-row").filter({ hasText: "Copy of Travel kit" }),
    ).toHaveCount(1);

    // A material change is versioned and listed (R8, R10)
    await bp.goto(`/brand/campaigns/${id}/build?step=compensation&w=${w}`);
    await bp
      .getByRole("form", { name: "Compensation and rights" })
      .getByLabel(/^Amount \(or lower end\)/)
      .fill("3500");
    await bp
      .getByRole("form", { name: "Compensation and rights" })
      .getByRole("button", { name: "Save and continue" })
      .click();
    await expect(bp.getByRole("form", { name: "Eligibility" })).toBeVisible();
    await bp.goto(`/brand/campaigns/${id}/build?step=review&w=${w}`);
    await bp.getByRole("button", { name: "Publish changes" }).click();
    await expect(bp.getByText(/Published\./)).toBeVisible();
    await bp.goto(`/brand/campaigns/${id}/changes?w=${w}`);
    await expect(
      bp.getByText(/Material change: .*compensation/i).first(),
    ).toBeVisible();
    await bp.screenshot({
      path: `${shots}/changes-desktop.png`,
      fullPage: true,
    });
    await bp.goto(`/brand/campaigns/${id}/preview?w=${w}`);
    await expect(
      bp
        .getByRole("article", { name: "Creator preview" })
        .getByText("Money: ₹3,500"),
    ).toBeVisible();

    for (const p of [
      `/brand/campaigns?w=${w}`,
      `/brand/campaigns/${id}/build?step=objective&w=${w}`,
      `/brand/campaigns/${id}/build?step=compensation&w=${w}`,
      `/brand/campaigns/${id}/build?step=review&w=${w}`,
      `/brand/campaigns/${id}/preview?w=${w}`,
      `/brand/campaigns/${id}/changes?w=${w}`,
    ])
      await overflowAndAxe(bp, p);
    await bp.setViewportSize({ width: 390, height: 844 });
    await bp.goto(`/brand/campaigns?w=${w}`);
    await bp.screenshot({
      path: `${shots}/campaigns-mobile.png`,
      fullPage: true,
    });
    for (const x of [b, r]) await x.close();
  });
});
