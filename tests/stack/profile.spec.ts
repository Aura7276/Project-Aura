import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { seedUser, signedIn } from "./helpers";

test.describe.configure({ mode: "serial" });
const unique = () => Math.random().toString(36).slice(2, 8);
async function activated(
  page: Page,
  request: Parameters<typeof seedUser>[0],
  context: Parameters<typeof signedIn>[0],
) {
  const seed = await seedUser(request, `m09-${unique()}@example.com`);
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
async function setupProfile(page: Page, username: string) {
  await page.goto("/creator/profile/edit");
  await page.getByLabel("Username").fill(username);
  await page
    .getByLabel("Headline (optional)")
    .fill("Budget travel stories for young Indians");
  await page
    .getByLabel("About (optional)")
    .fill(
      "I make short travel films about getting more out of every rupee, mostly in India.",
    );
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
}
async function addPiece(
  page: Page,
  title: string,
  visibility: "public" | "restricted" | "private",
  kind = "organic",
) {
  await page.goto("/creator/portfolio/new");
  const f = page.getByRole("form", { name: "Portfolio piece" });
  await f.getByLabel("What is it?").selectOption(kind);
  await f.getByLabel("Title").fill(title);
  await f.getByLabel("Who can see it").selectOption(visibility);
  await f.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

test.describe("M09 real routes with the local test stack (not Supabase)", () => {
  test("anonymous visitors cannot reach the Studio, and an unknown profile is not found", async ({
    page,
  }) => {
    for (const p of [
      "/creator/profile",
      "/creator/portfolio",
      "/creator/media-kit",
      "/creator/services",
      "/creator/rates",
      "/creator/profile/reviews",
    ]) {
      await page.goto(p);
      await expect(page, p).toHaveURL(/\/login/);
    }
    const r = await page.goto("/creator/nobody-here-yet");
    expect(r?.status()).toBe(404);
    const k = await page.goto("/kit/" + "0".repeat(64));
    expect(k?.status()).toBe(404);
  });

  test("build, validate, publish, view publicly, unpublish", async ({
    page,
    request,
    context,
    browser,
  }) => {
    await activated(page, request, context);
    await page.goto("/creator/profile");
    await expect(
      page.getByRole("heading", { name: "Your profile is private" }),
    ).toBeVisible();
    // a Studio route word is reserved, and the typed values survive the error
    await page.goto("/creator/profile/edit");
    await page.getByLabel("Username").fill("socials");
    await page.getByLabel("Headline (optional)").fill("Kept after an error");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText(/reserved/).first()).toBeVisible();
    await expect(page.getByLabel("Headline (optional)")).toHaveValue(
      "Kept after an error",
    );
    const username = `asha${unique()}`;
    await setupProfile(page, username);
    await addPiece(page, "Goa on a budget", "public");
    await addPiece(page, "Concept ad for a tea brand", "public", "speculative");
    await addPiece(page, "Private draft", "private");
    await page.goto("/creator/services");
    const sf = page.getByRole("form", { name: "Add a service" });
    await sf.getByLabel("Service name").fill("Instagram reel");
    await sf.getByLabel("Pricing").selectOption("range");
    await sf.getByLabel("Price (or lower end) (optional)").fill("5000");
    await sf.getByLabel("Upper end (optional)").fill("9000");
    await sf.getByLabel("Who can see the service").selectOption("public");
    await sf.getByRole("button", { name: "Add service" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    // not public before publishing, even by direct URL
    const anon = await browser.newContext();
    const visitor = await anon.newPage();
    expect((await visitor.goto(`/creator/${username}`))?.status()).toBe(404);
    await page.goto("/creator/profile");
    await expect(
      page.getByLabel("Also show me in creator discovery"),
    ).toBeDisabled(); // no qualifying account
    await page.getByRole("button", { name: "Publish profile" }).click();
    await expect(
      page.getByRole("heading", { name: "Your profile is published" }),
    ).toBeVisible();
    await visitor.goto(`/creator/${username}`);
    await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(
      /Asha Rao/,
    );
    await expect(visitor.getByText("Goa on a budget")).toBeVisible();
    await expect(
      visitor.getByText(/Speculative, self-initiated: not commissioned/),
    ).toBeVisible();
    await expect(visitor.getByText("Private draft")).toHaveCount(0);
    await expect(visitor.getByText("Rates on request")).toBeVisible();
    await expect(visitor.getByText(/5,000|9,000/)).toHaveCount(0);
    await expect(visitor.getByText(/No rating or score/)).toBeVisible();
    // preview inside the Studio
    await page.goto("/creator/profile/preview");
    await expect(
      page.getByText(/Preview: this is how your profile looks/),
    ).toBeVisible();
    // unpublish removes access immediately
    await page.goto("/creator/profile");
    await page.getByRole("button", { name: /Unpublish/ }).click();
    await expect(
      page.getByRole("heading", { name: "Your profile is private" }),
    ).toBeVisible();
    expect((await visitor.goto(`/creator/${username}`))?.status()).toBe(404);
    await anon.close();
  });

  test("media kit: public link hides rates, restricted link needs the recipient Brand, revoke and QR", async ({
    page,
    request,
    context,
    browser,
  }) => {
    await activated(page, request, context);
    await setupProfile(page, `kit${unique()}`);
    await addPiece(page, "Hostel reel", "public");
    await addPiece(page, "Restricted sample", "restricted", "ugc_sample");
    await page.goto("/creator/rates/packages");
    const pf = page.getByRole("form", { name: "Add a package" });
    await pf.getByLabel("Package name").fill("Launch bundle");
    await pf.getByLabel(/Deliverables, one per line/).fill("3 x Reel");
    await pf
      .getByLabel("Indicative price (or lower end) (optional)")
      .fill("20000");
    await pf.getByLabel("Who can see it").selectOption("restricted");
    await pf.getByRole("button", { name: "Add package" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await page.goto("/creator/media-kit/new");
    await page.getByLabel("Kit name").fill("Travel brands 2026");
    await page.getByRole("button", { name: "Create kit" }).click();
    await expect(
      page.getByRole("heading", { name: "Travel brands 2026" }),
    ).toBeVisible();
    const kitUrl = page.url().replace(/\/edit.*$/, "");
    // enable packages, then share publicly
    await page.getByLabel("Packages and rates").check();
    await page.getByRole("button", { name: "Save kit" }).click();
    await expect(page.getByText(/Kit saved/)).toBeVisible();
    await page.goto(kitUrl + "/share");
    await page.getByRole("button", { name: "Create link" }).click();
    await expect(page.getByText(/shown only once/)).toBeVisible();
    const publicLink = (await page.locator(".pf-secret code").textContent())!;
    await expect(
      page.getByRole("img", { name: "QR code for this link" }),
    ).toBeVisible();
    const anon = await browser.newContext();
    const v = await anon.newPage();
    await v.goto(publicLink);
    await expect(v.getByRole("heading", { name: "Asha Rao" })).toBeVisible();
    await expect(v.getByText("Hostel reel")).toBeVisible();
    await expect(v.getByText("Restricted sample")).toHaveCount(0);
    await expect(v.getByText("Launch bundle")).toHaveCount(0);
    const pdf = await v.request.get(publicLink + "/pdf");
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    expect(await pdf.text()).not.toContain("20,000");
    // restricted link for a Brand workspace
    const brand = await seedUser(
      request,
      `brand-${unique()}@example.com`,
      "Tea Co Buyer",
      "brand",
    );
    await page.goto(kitUrl + "/share");
    const sh = page.getByRole("form", { name: "Create a share link" });
    await sh.getByLabel("Link type").selectOption("restricted");
    await sh
      .getByLabel("Recipient workspace id (optional)")
      .fill(brand.workspace_id);
    await sh.getByLabel("Include rates and packages").check();
    await sh.getByRole("button", { name: "Create link" }).click();
    await expect(page.getByText(/shown only once/)).toBeVisible();
    const restrictedLink = (await page
      .locator(".pf-secret code")
      .textContent())!;
    await v.goto(restrictedLink);
    await expect(
      v.getByRole("heading", { name: "Sign in to view this media kit" }),
    ).toBeVisible();
    const bctx = await browser.newContext();
    await signedIn(bctx, brand);
    const b = await bctx.newPage();
    await b.goto(restrictedLink);
    await expect(b.getByText("Launch bundle")).toBeVisible();
    await expect(b.getByText("Restricted sample")).toBeVisible();
    await expect(b.getByText(/20,000/)).toBeVisible();
    await b.getByRole("button", { name: "Share" }).click();
    await expect(
      b.getByText(/the creator can see that your workspace viewed this/),
    ).toBeVisible();
    // revoke the public link
    await page.goto(kitUrl + "/share");
    await page.getByRole("button", { name: "Revoke now" }).last().click();
    await expect(page).toHaveURL(/revoked=1/);
    await v.goto(publicLink);
    await expect(
      v.getByRole("heading", { name: "This link has been turned off" }),
    ).toBeVisible();
    await page.goto("/creator/profile/analytics");
    await expect(page.getByText(/viewed Travel brands 2026/)).toBeVisible();
    await anon.close();
    await bctx.close();
  });

  test("testimonials come only from an invited outsider and wait for moderation", async ({
    page,
    request,
    context,
    browser,
  }) => {
    await activated(page, request, context);
    await page.goto("/creator/profile/reviews");
    await page.getByLabel(/Who is it for/).fill("Hostel Co");
    await page.getByRole("button", { name: "Create invitation link" }).click();
    const link = (await page.locator(".pf-secret code").textContent())!;
    const writer = await seedUser(
      request,
      `writer-${unique()}@example.com`,
      "Priya Shah",
      "creator",
    );
    const w = await browser.newContext();
    await signedIn(w, writer);
    const wp = await w.newPage();
    await wp.goto(link);
    await expect(
      wp.getByRole("heading", { name: /Write a testimonial for Asha Rao/ }),
    ).toBeVisible();
    await wp
      .getByLabel("Your name as it should appear")
      .fill("Priya at Hostel Co");
    await wp
      .getByLabel("Your testimonial")
      .fill(
        "Asha delivered three reels on time and followed the brief closely.",
      );
    await wp.getByRole("button", { name: "Send testimonial" }).click();
    await expect(wp.getByText(/checked by a reviewer/)).toBeVisible();
    await wp.goto(link);
    await expect(
      wp.getByRole("heading", { name: "This invitation is not valid" }),
    ).toBeVisible();
    await page.goto("/creator/profile/reviews");
    await expect(page.getByText("Awaiting moderation").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Show on my profile" }),
    ).toHaveCount(0);
    await w.close();
  });

  test("Studio and public pages have no serious accessibility violations and no horizontal overflow", async ({
    page,
    request,
    context,
    browser,
  }) => {
    await activated(page, request, context);
    const username = `a11y${unique()}`;
    await setupProfile(page, username);
    await addPiece(page, "Case of a hostel launch", "public", "case_study");
    await page.goto("/creator/profile");
    await page.getByRole("button", { name: "Publish profile" }).click();
    await expect(
      page.getByRole("heading", { name: "Your profile is published" }),
    ).toBeVisible();
    const pages = [
      "/creator/profile",
      "/creator/profile/edit",
      "/creator/profile/appearance",
      "/creator/portfolio",
      "/creator/portfolio/new",
      "/creator/services",
      "/creator/rates",
      "/creator/rates/packages",
      "/creator/media-kit",
      "/creator/media-kit/new",
      "/creator/profile/reviews",
      "/creator/profile/privacy",
      "/creator/profile/analytics",
      "/creator/profile/completeness",
      "/creator/profile/verification",
      "/creator/profile/optimize",
      "/creator/profile/availability",
      "/creator/profile/experience",
      `/creator/${username}`,
    ];
    for (const p of pages) {
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
          .map((v) => `${v.id}: ${v.nodes[0]?.html?.slice(0, 120)}`),
        p,
      ).toEqual([]);
    }
    for (const theme of ["midnight", "sage", "peach"]) {
      await page.goto("/creator/profile/appearance");
      await page.getByLabel("Theme").selectOption(theme);
      await page.getByRole("button", { name: "Save appearance" }).click();
      await expect(page.getByText("Appearance saved.")).toBeVisible();
      const anon = await browser.newContext();
      const v = await anon.newPage();
      await v.goto(`/creator/${username}`);
      const res = await new AxeBuilder({ page: v })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(
        res.violations
          .filter((x) => ["serious", "critical"].includes(x.impact ?? ""))
          .map((x) => `${x.id}: ${x.nodes[0]?.html?.slice(0, 120)}`),
        theme,
      ).toEqual([]);
      await anon.close();
    }
  });
});

test.describe("M09 visual evidence (screenshots of real pages with sample data typed in by the test)", () => {
  test("captures the public profile, a media kit and the Studio hub", async ({
    page,
    request,
    context,
    browser,
  }) => {
    test.setTimeout(180_000);
    await activated(page, request, context);
    const username = `asha.travels${unique()}`;
    await setupProfile(page, username);
    await page.goto("/creator/profile/appearance");
    await page.getByLabel("Cover").selectOption("waves");
    await page.getByRole("button", { name: "Save appearance" }).click();
    await expect(page.getByText("Appearance saved.")).toBeVisible();
    await addPiece(page, "Goa on ₹2,000 a day", "public");
    await addPiece(page, "Monsoon in Meghalaya", "public");
    await addPiece(
      page,
      "Concept ad for a chai brand",
      "public",
      "speculative",
    );
    await page.goto("/creator/portfolio/new?kind=case_study");
    const f = page.getByRole("form", { name: "Portfolio piece" });
    await f.getByLabel("Title").fill("Hostel launch in Hampi");
    await f
      .getByLabel("Brand (optional)")
      .fill("Sample Hostels (illustrative)");
    await f
      .getByLabel("Objective (optional)")
      .fill("Introduce a new hostel to budget travellers.");
    await f
      .getByLabel("Approach (optional)")
      .fill("Three short reels: arrival, the people, the rooftop at sunset.");
    await f
      .getByLabel("Your contribution (optional)")
      .fill("Concept, filming and edit.");
    await f
      .getByLabel("Deliverables (one per line) (optional)")
      .fill("3 reels\n5 stories");
    await f
      .getByLabel("Outcomes (one per line) (optional)")
      .fill("Delivered on schedule");
    await f.getByLabel("Who can see it").selectOption("public");
    await f.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByRole("heading", { name: "Hostel launch in Hampi" }),
    ).toBeVisible();
    await page.goto("/creator/services");
    const sf = page.getByRole("form", { name: "Add a service" });
    await sf.getByLabel("Service name").fill("Instagram reel");
    await sf
      .getByLabel(/What is included/)
      .fill("One 30 to 60 second reel\nTwo rounds of feedback");
    await sf.getByLabel("Who can see the service").selectOption("public");
    await sf.getByRole("button", { name: "Add service" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await page.goto("/creator/profile");
    await page.getByRole("button", { name: "Publish profile" }).click();
    await expect(
      page.getByRole("heading", { name: "Your profile is published" }),
    ).toBeVisible();
    const dir = "docs/development/evidence/m09";
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: `${dir}/studio-hub-desktop.png`,
      fullPage: true,
    });
    const anon = await browser.newContext({ deviceScaleFactor: 2 });
    const v = await anon.newPage();
    await v.setViewportSize({ width: 1280, height: 900 });
    await v.goto(`/creator/${username}`);
    await v.screenshot({
      path: `${dir}/public-profile-desktop.png`,
      fullPage: true,
    });
    await v.setViewportSize({ width: 390, height: 844 });
    await v.goto(`/creator/${username}`);
    await v.screenshot({
      path: `${dir}/public-profile-mobile.png`,
      fullPage: true,
    });
    await page.goto("/creator/media-kit/new");
    await page.getByLabel("Kit name").fill("Travel and hospitality 2026");
    await page
      .getByLabel("Who is it for (optional)")
      .fill("Hotels, hostels and travel brands");
    await page.getByRole("button", { name: "Create kit" }).click();
    await expect(
      page.getByRole("heading", { name: "Travel and hospitality 2026" }),
    ).toBeVisible();
    const kitUrl = page.url().replace(/\/edit.*$/, "");
    await page.goto(kitUrl + "/share");
    await page.getByRole("button", { name: "Create link" }).click();
    await expect(page.getByText(/shown only once/)).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: `${dir}/kit-share-qr-desktop.png`,
      fullPage: true,
    });
    const link = (await page.locator(".pf-secret code").textContent())!;
    await v.setViewportSize({ width: 1280, height: 900 });
    await v.goto(link);
    await v.screenshot({
      path: `${dir}/media-kit-desktop.png`,
      fullPage: true,
    });
    await anon.close();
  });
});
