import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { seedUser, signedIn } from "./helpers";

// M14 end to end on the real routes, against the local test stack (real PostgreSQL migrations, NOT Supabase).
// It never publishes a campaign, so the M10 suite's empty-marketplace check is unaffected.
test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 20_000 });
const unique = () => Math.random().toString(36).slice(2, 8);
const shots = "docs/development/evidence/m14";
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

test.describe("M14 real routes with the local test stack (not Supabase)", () => {
  test("anonymous visitors are sent to sign-in, and unknown public Brand pages are not found", async ({
    page,
  }) => {
    for (const p of [
      "/brand",
      "/brand/onboarding",
      "/brand/verification",
      "/brand/plan",
      "/admin/verification",
    ]) {
      await page.goto(p);
      await expect(page, p).toHaveURL(/\/login/);
    }
    expect((await page.goto("/brand/no-such-brand"))?.status()).toBe(404);
  });

  test("onboarding, business tools, plans, verification with an information request, and a private-by-default public profile", async ({
    browser,
    request,
  }) => {
    test.setTimeout(420_000);
    mkdirSync(shots, { recursive: true });
    const brand = await seedUser(
      request,
      `m14-${unique()}@example.com`,
      "Riya Shah",
      "brand",
      { mfa: true },
    );
    const reviewer = await seedUser(
      request,
      `rev14-${unique()}@example.com`,
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

    // Onboarding: two required steps, the rest optional (F03, F45, AC01)
    await bp.goto(`/brand?w=${w}`);
    await expect(bp).toHaveURL(/\/brand\/onboarding/);
    await expect(
      bp.getByRole("heading", { name: "Tell us about your business" }),
    ).toBeVisible();
    const basics = bp.getByRole("form", { name: "Business basics" });
    await basics.getByLabel(/^Brand name/).fill("");
    await basics.getByRole("button", { name: "Continue" }).click();
    await expect(basics.getByText("Use 2 to 80 characters.")).toBeVisible();
    await basics.getByLabel(/^Brand name/).fill("Coastline Hostels");
    await basics.getByLabel(/^Type of business/).selectOption("d2c");
    await basics.getByLabel(/^Industry/).fill("Travel");
    await basics.getByLabel(/^Website/).fill("http://coastline.example");
    await basics.getByRole("button", { name: "Continue" }).click();
    await expect(basics.getByText(/full https:\/\/ address/)).toBeVisible();
    await basics.getByLabel(/^Website/).fill("https://coastline.example");
    await bp.screenshot({
      path: `${shots}/onboarding-desktop.png`,
      fullPage: true,
    });
    await basics.getByRole("button", { name: "Continue" }).click();
    const obj = bp.getByRole("form", { name: "Objective and stage" });
    await obj.getByLabel(/^Primary objective/).selectOption("conversion");
    await obj.getByLabel("Photography").check();
    await obj.getByRole("button", { name: "Continue" }).click();
    const cust = bp.getByRole("form", { name: "Customers and products" });
    await cust.getByLabel(/^Your main product or service/).fill("Dorm bed");
    await cust
      .getByLabel(/^Your main customer group/)
      .fill("Budget backpackers");
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
    await expect(
      bp.getByRole("heading", { name: "Coastline Hostels", level: 1 }),
    ).toBeVisible();
    await expect(bp.getByText(/Your Brand workspace is set up/)).toBeVisible();
    await expect(bp.getByText("Not verified yet").first()).toBeVisible();
    await expect(bp.getByText(/Verify your business to go live/)).toBeVisible();
    await bp.screenshot({
      path: `${shots}/brand-home-desktop.png`,
      fullPage: true,
    });

    // Products with approved claims, audiences as hypotheses, guidelines, optional budget, socials (F11, F15, F19, F24, F26)
    await bp.goto(`/brand/products?w=${w}`);
    const add = bp.getByRole("form", { name: "Add a product" });
    await add.getByLabel(/^Name/).fill("Private room");
    await add.getByLabel(/^Price from/).fill("2000");
    await add.getByLabel(/^Price to/).fill("1500");
    await add.getByRole("button", { name: "Add" }).click();
    await expect(
      add.getByText("The upper price is below the lower one."),
    ).toBeVisible();
    await add.getByLabel(/^Price to/).fill("2600");
    await add
      .getByLabel(/^Approved claims/)
      .fill("Free breakfast\nRooftop cafe");
    await add.getByLabel("Budget backpackers").check();
    await add.getByRole("button", { name: "Add" }).click();
    await expect(bp.getByText("Private room")).toBeVisible();
    await bp.goto(`/brand/audiences?w=${w}`);
    await expect(bp.getByText("Hypothesis").first()).toBeVisible();
    await bp.goto(`/brand/guidelines?w=${w}`);
    const g = bp.getByRole("form", { name: "Brand guidelines" });
    await g.getByLabel(/^Tone words/).fill("warm, honest");
    await g.getByLabel(/^Brand colours/).fill("purple");
    await g.getByRole("button", { name: "Save guidelines" }).click();
    await expect(g.getByText(/six-digit hex colours/).first()).toBeVisible();
    await g.getByLabel(/^Brand colours/).fill("#5B4BD6, F4B740");
    await g.getByRole("button", { name: "Save guidelines" }).click();
    await expect(bp.getByText("Saved.")).toBeVisible();
    await bp.goto(`/brand/goals?w=${w}`);
    await expect(bp.getByText(/never a commitment/)).toBeVisible();
    const goal = bp.getByRole("form", { name: "Add a goal" });
    await goal.getByLabel(/^What you will measure/).fill("Direct bookings");
    await goal.getByLabel(/^Target/).fill("40");
    await goal.getByRole("button", { name: "Add goal" }).click();
    await expect(bp.getByText("Goal added.")).toBeVisible();
    await bp.goto(`/brand/socials?w=${w}`);
    const soc = bp.getByRole("form", { name: "Add a social account" });
    await soc.getByLabel(/^Handle/).fill("@coastlinehostels");
    await soc.getByLabel(/^Followers today/).fill("120");
    await soc.getByRole("button", { name: "Add account" }).click();
    await expect(
      bp.getByText(/120 followers · self-reported on/),
    ).toBeVisible();
    await expect(bp.getByText("1 of 10 accounts.")).toBeVisible();

    // Plans: generated at setup, editable, completed steps kept on refresh (F44)
    await bp.goto(`/brand/plan?w=${w}`);
    await expect(bp.getByRole("heading", { name: "7 days" })).toBeVisible();
    await expect(bp.getByText("Start business verification")).toBeVisible();
    await bp
      .getByRole("button", {
        name: /Mark as done: Start business verification/,
      })
      .click();
    await expect(
      bp.getByRole("button", {
        name: /Mark as not done: Start business verification/,
      }),
    ).toBeVisible();
    await bp
      .getByRole("button", { name: "Refresh suggestions" })
      .first()
      .click();
    await expect(
      bp.getByText(/Steps you edited or completed were kept/),
    ).toBeVisible();
    await expect(
      bp.getByRole("button", {
        name: /Mark as not done: Start business verification/,
      }),
    ).toBeVisible();
    await bp.screenshot({ path: `${shots}/plan-desktop.png`, fullPage: true });

    // Public profile stays private until verification (F46, AC03)
    await bp.goto(`/brand/profile?w=${w}`);
    await expect(
      bp.getByText(/stays private until your business is verified/),
    ).toBeVisible();

    // Verification: evidence by business type, declaration, information request, approval (F31–F37)
    await bp.goto(`/brand/verification?w=${w}`);
    const ev = bp.getByRole("form", { name: "Verification details" });
    await ev
      .getByLabel(/^Registered legal name/)
      .fill("Coastline Hostels Private Limited");
    await ev.getByRole("button", { name: "Save draft" }).click();
    await expect(bp.getByText("Draft saved.")).toBeVisible();
    const sub = bp.getByRole("form", { name: "Submit for review" });
    await sub.getByLabel(/I confirm these details are true/).check();
    await sub.getByRole("button", { name: "Submit for review" }).click();
    await expect(bp.getByText(/required evidence is missing/)).toBeVisible();
    await bp.reload();
    await ev
      .getByLabel(/^Registration number/)
      .fill("U55101 GA 2022 PTC 000123");
    await ev
      .getByLabel(/^Registered address/)
      .fill("7 Beach Road, Anjuna, Goa 403509");
    await ev.getByLabel(/^Representative's full name/).fill("Riya Shah");
    await ev.getByLabel(/^Representative's role/).fill("Director");
    await ev.getByLabel(/^Business email/).fill("riya@coastline.example");
    await ev.getByRole("button", { name: "Save draft" }).click();
    await expect(bp.getByText("Draft saved.")).toBeVisible();
    await bp.screenshot({
      path: `${shots}/verification-desktop.png`,
      fullPage: true,
    });
    await sub.getByRole("button", { name: "Submit for review" }).click();
    await expect(
      sub.getByText("Tick the declaration before submitting.").first(),
    ).toBeVisible();
    await sub.getByLabel(/I confirm these details are true/).check();
    await sub.getByRole("button", { name: "Submit for review" }).click();
    await expect(bp.getByText("With a reviewer").first()).toBeVisible();
    await rp.goto("/admin/verification");
    await rp.locator(`li[data-workspace="${w}"]`).getByRole("link").click();
    await expect(rp.getByText("U55101GA2022PTC000123")).toBeVisible();
    await expect(rp.getByText(/yes \(supporting only\)/)).toBeVisible();
    await rp.getByLabel("Decision").selectOption("info_requested");
    await rp
      .getByLabel("Reason (shown to the Brand)")
      .fill("Please add your GSTIN in the note.");
    await rp.getByRole("button", { name: "Record decision" }).click();
    await expect(rp.getByText("Decision recorded.")).toBeVisible();
    await rp.screenshot({
      path: `${shots}/reviewer-desktop.png`,
      fullPage: true,
    });
    await bp.goto(`/brand/verification?w=${w}`);
    await expect(bp.getByText("More information needed").first()).toBeVisible();
    await expect(
      bp.getByText(/Please add your GSTIN in the note/).first(),
    ).toBeVisible();
    await ev
      .getByLabel(/^Anything the reviewer should know/)
      .fill("GSTIN 30ABCDE1234F1Z5");
    await ev.getByRole("button", { name: "Save draft" }).click();
    await expect(bp.getByText("Draft saved.")).toBeVisible();
    await sub.getByLabel(/I confirm these details are true/).check();
    await sub.getByRole("button", { name: "Submit for review" }).click();
    await expect(bp.getByText("With a reviewer").first()).toBeVisible();
    await rp.goto("/admin/verification");
    await rp.locator(`li[data-workspace="${w}"]`).getByRole("link").click();
    await rp
      .getByLabel("Reason (shown to the Brand)")
      .fill("Registration, director and GSTIN checked.");
    await rp.getByRole("button", { name: "Record decision" }).click();
    await expect(rp.getByText("Decision recorded.")).toBeVisible();
    await bp.goto(`/brand?w=${w}`);
    await expect(bp.getByText("Business verified").first()).toBeVisible();

    // Publication: reserved addresses refused; only public fields shown; unpublish hides it (F10, F46, F47)
    await bp.goto(`/brand/profile?w=${w}`);
    const prof = bp.getByRole("form", { name: "Business profile" });
    await prof
      .getByLabel(/^About/)
      .fill(
        "Hostels for budget travellers along the Goa coast, with rooftop cafes and free breakfast.",
      );
    await prof.getByLabel(/^Tagline/).fill("Stay more, spend less");
    await prof.getByRole("button", { name: "Save" }).click();
    await expect(bp.getByText("Saved.")).toBeVisible();
    const pub = bp.getByRole("form", { name: "Publish your profile" });
    await pub.getByLabel(/^Address/).fill("campaigns");
    await pub.getByRole("button", { name: "Publish profile" }).click();
    await expect(pub.getByText(/That word is reserved/)).toBeVisible();
    const slug = `coastline-${unique()}`;
    await pub.getByLabel(/^Address/).fill(slug);
    await pub.getByRole("button", { name: "Publish profile" }).click();
    await expect(
      bp.getByText(/Published\. Anyone with the link/),
    ).toBeVisible();
    const anon = await browser.newContext();
    const ap = await anon.newPage();
    await ap.goto(`/brand/${slug}`);
    await expect(
      ap.getByRole("heading", { name: "Coastline Hostels", level: 1 }),
    ).toBeVisible();
    await expect(ap.getByText("Private room")).toBeVisible();
    await expect(ap.getByText(/Business verified since/)).toBeVisible();
    const text = await ap.locator("main").innerText();
    expect(text).not.toMatch(
      /Private Limited|Riya|U55101|GSTIN|Budget backpackers|Direct bookings/,
    );
    await ap.screenshot({
      path: `${shots}/public-brand-desktop.png`,
      fullPage: true,
    });
    await ap.setViewportSize({ width: 390, height: 844 });
    await ap.screenshot({
      path: `${shots}/public-brand-mobile.png`,
      fullPage: true,
    });
    await bp.goto(`/brand/intelligence?w=${w}`);
    await expect(
      bp.getByText(/Budget backpackers \(hypothesis\)/),
    ).toBeVisible();
    await bp.screenshot({ path: `${shots}/brief-desktop.png`, fullPage: true });
    await bp.goto(`/brand/profile?w=${w}`);
    await bp
      .getByRole("form", { name: "Unpublish your profile" })
      .getByRole("button", { name: "Unpublish" })
      .click();
    await expect(bp.getByText("Private", { exact: true })).toBeVisible();
    expect((await ap.goto(`/brand/${slug}`))?.status()).toBe(404);

    // accessibility and overflow on every M14 page
    for (const [pg, p] of [
      [bp, `/brand?w=${w}`],
      [bp, `/brand/profile?w=${w}`],
      [bp, `/brand/products?w=${w}`],
      [bp, `/brand/audiences?w=${w}`],
      [bp, `/brand/goals?w=${w}`],
      [bp, `/brand/plan?w=${w}`],
      [bp, `/brand/guidelines?w=${w}`],
      [bp, `/brand/preferences/creators?w=${w}`],
      [bp, `/brand/competitors?w=${w}`],
      [bp, `/brand/socials?w=${w}`],
      [bp, `/brand/intelligence?w=${w}`],
      [bp, `/brand/verification?w=${w}`],
      [bp, `/brand/onboarding?w=${w}&step=objective`],
      [rp, "/admin/verification"],
    ] as const)
      await overflowAndAxe(pg, p);
    await bp.setViewportSize({ width: 390, height: 844 });
    await bp.goto(`/brand?w=${w}`);
    await bp.screenshot({
      path: `${shots}/brand-home-mobile.png`,
      fullPage: true,
    });
    for (const x of [b, r, anon]) await x.close();
  });
});
