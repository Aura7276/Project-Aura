import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const pv = (page: string, situation = "aspiring") =>
  `/dev/studio-preview/${page}?situation=${situation}`;
const pages = [
  "dashboard",
  "actions",
  "progress",
  "recommendations",
  "create",
  "grow",
  "studio",
];
const widths = [320, 360, 390, 430, 768, 1024, 1440, 1920];
const creatorRoutes = [
  "/creator",
  "/creator/dashboard",
  "/creator/actions",
  "/creator/progress",
  "/creator/recommendations",
  "/creator/create",
  "/creator/grow",
  "/creator/studio",
  "/creator/search?q=ideas",
  "/creator/notifications",
  "/creator/settings/dashboard",
];

test.describe("M04 access control (real routes)", () => {
  test("anonymous visitors cannot reach any Creator Studio route", async ({
    page,
  }) => {
    for (const path of creatorRoutes) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/login/);
    }
  });
});

test.describe("M04 desktop navigation (F03)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test("shows a persistent sidebar with the five areas, an active indicator and honest planned states", async ({
    page,
  }) => {
    await page.goto(pv("dashboard"));
    const side = page.getByRole("complementary", {
      name: "Creator Studio sidebar",
    });
    await expect(side).toBeVisible();
    for (const [name, href] of [
      ["Home", "/creator/dashboard"],
      ["Grow", "/creator/grow"],
      ["Create", "/creator/create"],
      ["Collaborate", "/creator/recommendations"],
      ["My Studio", "/creator/studio"],
    ])
      await expect(
        side.getByRole("link", { name, exact: true }),
      ).toHaveAttribute("href", href);
    await expect(
      side.getByRole("link", { name: "Home", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("navigation", { name: "Primary" }),
    ).toBeHidden();
    for (const m of [
      "M05",
      "M06",
      "M07",
      "M08",
      "M10",
      "M11",
      "M12",
      "M09",
      "M13",
    ])
      if (
        m !== "M05" &&
        m !== "M06" &&
        m !== "M09" &&
        m !== "M10" &&
        m !== "M11"
      )
        await expect(side.getByText(`Planned · ${m}`).first()).toBeVisible();
    // M06 delivered Analytics and Experiments: they are now real links, and no "Planned · M06" state remains.
    await expect(side.getByText("Planned · M06")).toHaveCount(0);
    await expect(side.getByRole("link", { name: "Analytics" })).toHaveAttribute(
      "href",
      "/creator/analytics",
    );
    await expect(
      side.getByRole("link", { name: "Experiments" }),
    ).toHaveAttribute("href", "/creator/experiments");
    await expect(
      side.getByText("Growth Assistant", { exact: true }),
    ).toBeVisible();
    await expect(
      side.getByRole("link", { name: "Growth Assistant" }),
    ).toHaveCount(0); // planned destinations are never links
  });
  test("every link in the shell resolves (no dead links)", async ({
    page,
    request,
  }) => {
    await page.goto(pv("dashboard"));
    const hrefs = await page
      .locator("a[href^='/']")
      .evaluateAll((as) => [
        ...new Set(
          as.map(
            (a) => (a as HTMLAnchorElement).getAttribute("href")!.split("#")[0],
          ),
        ),
      ]);
    expect(hrefs.length).toBeGreaterThan(10);
    for (const h of hrefs) {
      const r = await request.get(h, { maxRedirects: 0 });
      expect([200, 307, 308], h).toContain(r.status());
    }
  });
  test("header offers search, quick create, assistant and notifications", async ({
    page,
  }) => {
    await page.goto(pv("dashboard"));
    const search = page.getByRole("search");
    await expect(search).toHaveAttribute("action", "/creator/search");
    await expect(search.getByLabel("Search Creator Studio")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Quick create" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open Growth Assistant" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Notifications" }),
    ).toHaveAttribute("href", "/creator/notifications");
    await expect(
      page.getByLabel("Notifications").locator(".."),
    ).not.toContainText(/\b\d+ unread\b/);
  });
  test("the account menu offers security, workspace switching and settings", async ({
    page,
  }) => {
    await page.goto(pv("dashboard"));
    await page
      .getByRole("complementary")
      .getByText("Illustrative Creator")
      .last()
      .click();
    const menu = page.locator(".st-side details.st-account");
    await expect(
      menu.getByRole("link", { name: /Account security/ }),
    ).toHaveAttribute("href", "/security");
    await expect(
      menu.getByRole("link", { name: /Switch workspace/ }),
    ).toHaveAttribute("href", "/workspaces");
    await expect(
      menu.getByRole("link", { name: /Dashboard settings/ }),
    ).toHaveAttribute("href", "/creator/settings/dashboard");
  });
  test("active area follows the page", async ({ page }) => {
    for (const [p, area] of [
      ["actions", "Grow"],
      ["create", "Create"],
      ["recommendations", "Collaborate"],
      ["studio", "My Studio"],
    ]) {
      await page.goto(pv(p));
      await expect(
        page
          .getByRole("complementary")
          .getByRole("link", { name: area, exact: true }),
        p,
      ).toHaveAttribute("aria-current", /^(page|true)$/);
    }
  });
});

test.describe("M04 mobile navigation (F04)", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("shows a bottom bar with the five areas and no sidebar", async ({
    page,
  }) => {
    await page.goto(pv("dashboard"));
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link")).toHaveCount(5);
    await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      page.getByRole("complementary", { name: "Creator Studio sidebar" }),
    ).toBeHidden();
  });
  test("the extended drawer traps focus, closes with Escape and returns focus", async ({
    page,
  }) => {
    await page.goto(pv("dashboard"));
    const trigger = page.getByRole("button", { name: "Open menu" });
    await trigger.click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    const account = drawer.locator("details.st-account");
    await expect(drawer).toBeVisible();
    await drawer.locator("summary").click();
    await expect(
      account.getByRole("link", { name: /Account security/ }),
    ).toHaveAttribute("href", "/security");
    await expect(
      account.getByRole("link", { name: /Switch workspace/ }),
    ).toHaveAttribute("href", "/workspaces");
    for (const t of [
      "Search",
      "Notifications",
      "Quick create",
      "Growth Assistant",
      "Take the tour",
    ])
      await expect(
        drawer
          .getByRole("link", { name: t })
          .or(drawer.getByRole("button", { name: t })),
      ).toBeVisible();
    // Focus cannot reach the page behind the modal drawer. A native modal dialog may hand focus to the browser's own UI between
    // cycles (activeElement is then body), so every step is checked rather than a fixed number of presses.
    let inside = 0;
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("Tab");
      const where = await page.evaluate(() => {
        const a = document.activeElement;
        if (!a || a === document.body) return "browser";
        return a.closest("dialog") ? "drawer" : "page";
      });
      expect(where, `Tab ${i + 1}`).not.toBe("page");
      if (where === "drawer") inside++;
    }
    expect(inside).toBeGreaterThan(40);
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
  });
  test("quick create and the assistant open from the drawer", async ({
    page,
  }) => {
    await page.goto(pv("dashboard"));
    await page.getByRole("button", { name: "Open menu" }).click();
    await page
      .getByRole("dialog", { name: "Menu" })
      .getByRole("button", { name: "Quick create" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Quick create" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page
      .getByRole("dialog", { name: "Menu" })
      .getByRole("button", { name: "Growth Assistant" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Growth Assistant" }),
    ).toBeVisible();
  });
  test("fixed navigation never covers content or focused form controls", async ({
    page,
  }) => {
    await page.goto(pv("create"));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const navTop = await page
      .getByRole("navigation", { name: "Primary" })
      .evaluate((n) => n.getBoundingClientRect().top);
    const lastBottom = await page
      .locator("main > *:last-child")
      .last()
      .evaluate((n) => n.getBoundingClientRect().bottom);
    expect(lastBottom).toBeLessThanOrEqual(navTop + 1);
    await page.getByLabel("Idea", { exact: true }).first().focus();
    const r = await page
      .getByLabel("Idea", { exact: true })
      .first()
      .evaluate((n) => n.getBoundingClientRect());
    expect(r.bottom).toBeLessThanOrEqual(navTop + 1);
  });
});

test.describe("M04 dialogs: quick create and assistant (F07, F14, AC02)", () => {
  test("quick create lists only what works and explains what does not", async ({
    page,
  }) => {
    await page.goto(pv("dashboard", "below100"));
    await page.getByRole("button", { name: "Quick create" }).click();
    const d = page.getByRole("dialog", { name: "Quick create" });
    await expect(
      d.getByRole("heading", { name: "Capture an idea" }),
    ).toBeVisible();
    await expect(
      d.getByRole("heading", { name: "Record progress" }),
    ).toBeVisible();
    await expect(
      d.getByRole("link", { name: "Edit my goals" }),
    ).toHaveAttribute("href", "/onboarding/creator/goals");
    await expect(
      d.getByRole("button", { name: "Add portfolio item" }),
    ).toBeDisabled();
    await expect(
      d.getByText(
        /Portfolio and media kit tools arrive with the profile module/,
      ),
    ).toBeVisible();
    await expect(d.getByRole("button", { name: "Save idea" })).toBeDisabled(); // preview cannot persist, so it never pretends to
    await expect(
      d.getByText("Preview: nothing is saved.").first(),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(d).toBeHidden();
  });
  test("with no measurable goal, record progress explains the next step instead of faking a form", async ({
    page,
  }) => {
    await page.goto(pv("dashboard", "aspiring"));
    await page.getByRole("button", { name: "Quick create" }).click();
    await expect(
      page
        .getByRole("dialog", { name: "Quick create" })
        .getByText(/no goal with a number to track yet/),
    ).toBeVisible();
  });
  test("the assistant is honestly unavailable, scoped to the workspace and page, and offers manual tools", async ({
    page,
  }) => {
    await page.goto(pv("actions"));
    await page.getByRole("button", { name: "Open Growth Assistant" }).click();
    const d = page.getByRole("dialog", { name: "Growth Assistant" });
    await expect(d).toContainText("not available yet");
    await expect(d).toContainText("Illustrative Creator");
    await expect(d).toContainText("Grow");
    await expect(d.getByRole("textbox")).toHaveCount(0); // no simulated conversation
    for (const [n, h] of [
      ["Today’s actions", "/creator/actions"],
      ["Record progress", "/creator/progress"],
      ["Capture an idea", "/creator/create"],
      ["Read a guide", "/resources"],
    ])
      await expect(d.getByRole("link", { name: n })).toHaveAttribute("href", h);
    await expect(d).not.toContainText(/I can help|Hello!|As an AI/);
  });
});

test.describe("M04 personalization and honest data (F05, F16, AC01)", () => {
  test("aspiring Creator with no account: actionable, no fabricated metrics", async ({
    page,
  }) => {
    await page.goto(pv("dashboard", "aspiring"));
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "starting routine",
    );
    await expect(
      page.getByRole("heading", { name: "Today’s actions" }),
    ).toBeVisible();
    const cards = await page.locator(".st-card h2").allTextContents();
    expect(cards[0]).toBe("Today’s actions");
    expect(cards.indexOf("Commercial overview")).toBeGreaterThan(
      cards.indexOf("Today’s actions"),
    );
    expect(cards.indexOf("Commercial overview")).toBeGreaterThan(
      cards.indexOf("Goal progress"),
    );
    await expect(
      page.getByText(/No audience numbers are shown because none exist yet/),
    ).toBeVisible();
    await expect(page.getByText("Not available yet · M13")).toBeVisible();
    const body = await page.locator("main").innerText();
    expect(body).not.toMatch(
      /[₹$€£]\s?\d|wallet|balance|\d+(\.\d+)?%|\d[\d,]* followers|engagement rate: \d/i,
    );
    const n = await page.locator("[data-tour='actions'] .st-item").count();
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(5);
  });
  test("Creator below 100 followers keeps full growth access and gets the standard explanation, never a summed total", async ({
    page,
  }) => {
    await page.goto(pv("dashboard", "below100"));
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Consistency",
    );
    await expect(
      page
        .getByText(
          /need at least one of your own accounts with 100 or more followers/,
        )
        .first(),
    ).toBeVisible();
    await expect(page.getByText(/not added together/).first()).toBeVisible();
    await expect(page.getByText(/120 followers/)).toHaveCount(0);
    await expect(page.getByText("Self-reported").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Today’s actions" }),
    ).toBeVisible();
  });
  test("a qualifying account is described as unverified, never verified", async ({
    page,
  }) => {
    await page.goto(pv("dashboard", "qualifying"));
    await expect(
      page.getByText(/self-reported and unverified/).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/meets the 100-follower guide/).first(),
    ).toBeVisible();
    await expect(page.locator("main")).not.toContainText(
      /\bverified account\b|commercially verified/i,
    );
  });
  test("a UGC-focused Creator sees UGC treated separately from follower count, with recommendations raised", async ({
    page,
  }) => {
    await page.goto(pv("dashboard", "ugc"));
    const cards = await page.locator(".st-card h2").allTextContents();
    expect(cards.indexOf("Opportunities")).toBeLessThan(
      cards.indexOf("Profile checklist"),
    );
    await expect(
      page.getByText(/UGC is assessed separately/).first(),
    ).toBeVisible();
    await expect(page.getByText(/Draft two sample UGC ideas/)).toBeVisible();
    await expect(page.getByText("Preparation only · M09")).toBeVisible();
  });
  test("private and unverified notices are always shown", async ({ page }) => {
    await page.goto(pv("dashboard", "below100"));
    const n = page.getByRole("region", { name: "Important notices" });
    await expect(n).toContainText("Your profile is private");
    await expect(n).toContainText("self-reported and unverified");
  });
});

test.describe("M04 daily actions, progress and recommendations (F06, F10, F11, AC03, AC05)", () => {
  test("actions show categories, plan origin, dependency labels and distinguish preparation from completion", async ({
    page,
  }) => {
    await page.goto(pv("actions", "aspiring"));
    await expect(
      page.getByRole("heading", { level: 1, name: "Daily actions" }),
    ).toBeVisible();
    await expect(page.getByText("From your plan").first()).toBeVisible();
    await expect(
      page.getByText(/Marking this done means you prepared/).first(),
    ).toBeVisible();
    await expect(page.getByText("Nothing earlier yet.")).toBeVisible();
    await expect(page.getByText(/not AI-generated/i).first()).toBeVisible();
    for (const b of await page.getByRole("button", { name: /^Done:/ }).all())
      await expect(b).toBeDisabled();
  });
  test("progress renders a real chart only with two or more observations, with a data table", async ({
    page,
  }) => {
    await page.goto(pv("progress", "below100"));
    const chart = page.getByRole("img", {
      name: /3 self-reported observations from 2026-11-01 to 2026-11-23, from 40 to 62/,
    });
    await expect(chart).toBeVisible();
    await page.getByText("Show the data").first().click();
    await expect(page.getByRole("cell", { name: "2026-11-12" })).toBeVisible();
    await expect(
      page.getByText(/does not show what caused the change/),
    ).toBeVisible();
    await expect(
      page.getByText(
        /% of the way from your starting number \(40, self-reported\)/,
      ),
    ).toBeVisible();
  });
  test("progress without observations shows no chart, no invented numbers and explains the gap", async ({
    page,
  }) => {
    await page.goto(pv("progress", "aspiring"));
    await expect(page.locator("svg.st-chart")).toHaveCount(0);
    await expect(
      page.getByText(
        /No social account is added, so there are no account observations/,
      ),
    ).toBeVisible();
    await expect(
      page
        .getByText(/not enough recorded activity to draw any conclusions/)
        .first(),
    ).toBeVisible();
    await expect(
      page.getByText(/email delivery is not set up|Email digest: off/),
    ).toBeVisible();
    expect(await page.locator("main").innerText()).not.toMatch(
      /\b(sent|delivered)\b/i,
    );
  });
  test("a single observation does not draw a chart", async ({ page }) => {
    await page.goto(pv("progress", "qualifying"));
    await expect(page.locator("svg.st-chart")).toHaveCount(0);
    await expect(page.getByText(/One observation so far/)).toBeVisible();
  });
  test("recommendations show an honest empty state and explain every eligibility facet", async ({
    page,
  }) => {
    await page.goto(pv("recommendations", "below100"));
    await expect(
      page.getByText(/No published opportunities yet/).first(),
    ).toBeVisible();
    for (const h of [
      "Growth access",
      "Standard influencer collaborations",
      "UGC",
      "Missing account observations",
      "Account ownership",
      "Commercial verification",
      "Campaign-specific requirements",
    ])
      await expect(
        page.getByRole("heading", { name: h, exact: true }),
      ).toBeVisible();
    await expect(
      page.getByText(/Industries you excluded \(1\) are never recommended/),
    ).toBeVisible();
    await expect(page.locator("main")).not.toContainText(
      /Brand name|Sponsored|earn up to|guaranteed/i,
    );
    await expect(
      page.getByText(
        /No private goals or challenges are ever shared with a Brand/,
      ),
    ).toBeVisible();
  });
  test("create offers idea capture and an honest calendar readiness state", async ({
    page,
  }) => {
    await page.goto(pv("create", "aspiring"));
    await expect(
      page.getByText(/calendar and planner are planned for M08/),
    ).toBeVisible();
    await expect(page.getByText(/Planned · M08/).first()).toBeVisible();
    await expect(page.getByText("No ideas yet.")).toBeVisible();
  });
});

test.describe("M04 walkthrough (F15, AC05)", () => {
  test("is offered, skippable, steppable by keyboard and does not block use", async ({
    page,
  }) => {
    await page.goto(pv("dashboard"));
    await expect(
      page.getByRole("region", { name: "Product walkthrough offer" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Today’s actions" }),
    ).toBeVisible(); // usable without taking it
    await page.getByRole("button", { name: "Start tour" }).click();
    const tour = page.getByRole("region", { name: "Product walkthrough" });
    await expect(tour).toContainText("Step 1 of 9");
    await expect(page.locator("[data-tour-active='true']")).toHaveCount(1);
    await page.keyboard.press("Enter"); // Next is focused
    await expect(tour).toContainText("Step 2 of 9");
    for (let i = 0; i < 7; i++)
      await tour.getByRole("button", { name: "Next" }).click();
    await expect(tour).toContainText("Step 9 of 9");
    await tour.getByRole("button", { name: "Done" }).click();
    await expect(tour).toBeHidden();
    await expect(page.locator("[data-tour-active]")).toHaveCount(0);
  });
  test("can be skipped at any step and with Escape", async ({ page }) => {
    await page.goto(pv("dashboard"));
    await page.getByRole("button", { name: "Not now" }).click();
    await expect(
      page.getByRole("region", { name: "Product walkthrough offer" }),
    ).toBeHidden();
    await page.goto(pv("dashboard") + "&tour=1");
    const tour = page.getByRole("region", { name: "Product walkthrough" });
    await expect(tour).toBeVisible();
    await expect(page.locator("[data-tour-active='true']")).toHaveCount(1); // set after hydration, so the key handler is attached
    await page.keyboard.press("Escape");
    await expect(tour).toBeHidden();
  });
  test("is repeatable via the tour link", async ({ page }) => {
    await page.goto(pv("dashboard") + "&tour=1");
    await expect(
      page.getByRole("region", { name: "Product walkthrough" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Skip tour" }).click();
    await page.goto(pv("dashboard") + "&tour=1");
    await expect(
      page.getByRole("region", { name: "Product walkthrough" }),
    ).toBeVisible();
  });
});

test.describe("M04 reduced motion and keyboard", () => {
  test("honours prefers-reduced-motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(pv("dashboard"));
    const d = await page
      .locator(".st-btn")
      .first()
      .evaluate((n) => getComputedStyle(n).transitionDuration);
    expect(d).toBe("0s");
  });
  test("the skip link is first and reaches the main content", async ({
    page,
  }) => {
    await page.goto(pv("dashboard"));
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to content" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
  });
});

async function overflow(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
}
test.describe("M04 responsive layout", () => {
  for (const width of widths)
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const p of pages) {
        await page.goto(pv(p, "below100"));
        await expect(page.getByRole("main")).toBeVisible();
        expect(await overflow(page), `${p} at ${width}`).toBeLessThanOrEqual(0);
      }
    });
});
test.describe("M04 accessibility (axe, WCAG 2 A/AA)", () => {
  const scan = async (page: Page) =>
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
    ).violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
    );
  for (const p of pages)
    for (const w of [390, 1440])
      test(`no axe violations on ${p} at ${w}px`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: 900 });
        await page.goto(pv(p, p === "progress" ? "below100" : "aspiring"));
        expect(await scan(page)).toEqual([]);
      });
  test("no axe violations with each dialog and the tour open", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(pv("dashboard", "below100"));
    await page.getByRole("button", { name: "Open menu" }).click();
    expect(await scan(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Quick create" }).click();
    expect(await scan(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Open Growth Assistant" }).click();
    expect(await scan(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Start tour" }).click();
    expect(await scan(page)).toEqual([]);
  });
  test("every situation passes axe on the dashboard", async ({ page }) => {
    for (const s of ["aspiring", "below100", "qualifying", "ugc"]) {
      await page.goto(pv("dashboard", s));
      expect(await scan(page), s).toEqual([]);
    }
  });
});

test.describe("M04 contrast on the dark accent card", () => {
  test("labels, hints and buttons on the dark card meet 4.5:1 against its background", async ({
    page,
  }) => {
    await page.goto(pv("progress", "below100"));
    const ratios = await page.evaluate(() => {
      const lum = (c: string) => {
        const m = c
          .match(/\d+(\.\d+)?/g)!
          .slice(0, 3)
          .map(Number)
          .map((v) => {
            const x = v / 255;
            return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
          });
        return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
      };
      const card = document.querySelector(".st-card.accent") as HTMLElement;
      const bg = getComputedStyle(card).backgroundColor;
      const out: Record<string, number> = {};
      for (const [name, el] of Object.entries({
        label: card.querySelector("label"),
        hint: card.querySelector(".st-hint"),
        heading: card.querySelector("h2"),
        button: card.querySelector("button.st-btn.primary"),
      }) as [string, HTMLElement | null][]) {
        if (!el) continue;
        const fg = getComputedStyle(el).color;
        const back =
          name === "button" ? getComputedStyle(el).backgroundColor : bg;
        const [a, b] = [lum(fg), lum(back)];
        out[name] = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      }
      return out;
    });
    for (const [k, v] of Object.entries(ratios))
      expect(v, k).toBeGreaterThanOrEqual(4.5);
  });
});
