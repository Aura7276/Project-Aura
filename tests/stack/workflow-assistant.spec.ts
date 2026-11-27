// M20 end to end on the real routes, against the local test stack (real PostgreSQL migrations, NOT Supabase).
// No AI provider is configured on the stack, so this covers the offline mode, which is the only mode AURA has until the owner
// chooses a provider: questions are kept, the shared context is shown, and drafts written by the team go through the same
// approval. The provider adapter itself is covered by tests/unit/m20-domain.test.ts with a mocked network; nothing here is AI output.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { seedUser, signedIn } from "./helpers";

test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 20_000 });
const unique = () => Math.random().toString(36).slice(2, 8);
const shots = "docs/development/evidence/m20";
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

test.describe("M20 Brand AI assistant on real routes with the local test stack (not Supabase)", () => {
  test("anonymous visitors are sent to sign-in", async ({ page }) => {
    for (const p of ["/brand/assistant", "/brand/assistant/settings"]) {
      await page.goto(p);
      await expect(page, p).toHaveURL(/\/login/);
    }
  });

  test("offline mode, shared context, manual drafts with explicit approval, memory and isolation", async ({
    browser,
    request,
  }) => {
    test.setTimeout(300_000);
    mkdirSync(shots, { recursive: true });
    const brand = await seedUser(
      request,
      `m20-${unique()}@example.com`,
      "Riya Shah",
      "brand",
      { mfa: true },
    );
    const other = await seedUser(
      request,
      `m20o-${unique()}@example.com`,
      "Other Owner",
      "brand",
      { mfa: true },
    );
    const b = await browser.newContext();
    await signedIn(b, brand);
    const bp = await b.newPage();
    const w = brand.workspace_id;
    await onboard(bp, w, "Coastline Hostels");

    // Home: honest offline status, allowance, sources
    await bp
      .getByRole("navigation", { name: "Brand" })
      .getByRole("link", { name: "Assistant" })
      .click();
    await expect(
      bp.getByRole("heading", { name: "Assistant", level: 1 }),
    ).toBeVisible();
    await expect(bp.getByText(/Assistant offline\./)).toBeVisible();
    await expect(bp.getByText(/No AI provider is configured/)).toBeVisible();
    await expect(bp.getByText("0 of 100")).toBeVisible();
    await expect(
      bp.getByText("Memory is off.", { exact: false }),
    ).toBeVisible();

    // A brief needs a campaign
    const start = bp.getByRole("form", { name: "Start a conversation" });
    await start.getByLabel(/^What do you want help with/).selectOption("brief");
    await start.getByRole("button", { name: "Start" }).click();
    await expect(
      start.getByText("Choose a campaign for this task.").first(),
    ).toBeVisible();

    // Start a plan conversation and ask: offline, the question is kept and no allowance is used
    await start.getByLabel(/^What do you want help with/).selectOption("plan");
    await start.getByLabel(/^Name/).fill("First month");
    await start.getByRole("button", { name: "Start" }).click();
    await expect(
      bp.getByRole("heading", { name: "First month", level: 1 }),
    ).toBeVisible();
    const convUrl = bp.url();
    await bp.getByText(/What will be shared/).click();
    await expect(bp.locator(".ba-context pre")).toContainText(
      "Coastline Hostels",
    );
    await expect(bp.locator(".ba-context pre")).not.toContainText("budget");
    const ask = bp.getByRole("form", { name: "Ask the assistant" });
    await ask
      .getByLabel(/^Your question/)
      .fill("What should we do in the first month?");
    await ask.getByRole("button", { name: "Ask" }).click();
    await expect(ask.getByText(/The assistant is offline/)).toBeVisible();
    await bp.reload();
    await expect(bp.locator(".ba-turn.me")).toContainText(
      "What should we do in the first month?",
    );
    await expect(bp.locator(".ba-turn.ai.offline")).toContainText(
      "no AI provider is configured",
    );
    await expect(bp.getByText("AI suggestion")).toHaveCount(0);

    // Manual draft, then approval needs the tick
    const man = bp.getByRole("form", { name: "Write a draft" });
    await expect(man.getByLabel(/^Draft type/)).toHaveValue("plan_items");
    await man
      .getByLabel(/^Draft$/)
      .fill(
        "Post three dorm tours on Instagram\nAsk five past guests for a review",
      );
    await man.getByRole("button", { name: "Save draft" }).click();
    await expect(
      man.getByText("Draft saved. Approve it when you are ready."),
    ).toBeVisible();
    await bp.reload();
    const draft = bp.getByRole("article", { name: "Plan steps draft" });
    await expect(draft.getByText("Written by your team")).toBeVisible();
    await expect(
      draft.getByText("Post three dorm tours on Instagram"),
    ).toBeVisible();
    await bp.screenshot({
      path: `${shots}/conversation-desktop.png`,
      fullPage: true,
    });
    const approve = draft.getByRole("form", { name: "Approve Plan steps" });
    await approve
      .getByRole("button", { name: "Add these steps to my plan" })
      .click();
    await expect(
      approve.getByText("Tick the box to confirm.").first(),
    ).toBeVisible();
    await approve
      .getByLabel("I have reviewed this draft and want to apply it")
      .check();
    await approve
      .getByRole("button", { name: "Add these steps to my plan" })
      .click();
    await expect(
      draft.getByText(/Approved .*2 steps are in your plan\./),
    ).toBeVisible();
    await expect(
      draft.getByRole("form", { name: "Approve Plan steps" }),
    ).toHaveCount(0);
    await bp.goto(`/brand/plan?w=${w}`);
    await expect(
      bp.getByText("Post three dorm tours on Instagram"),
    ).toBeVisible();
    await expect(
      bp.getByText("Ask five past guests for a review"),
    ).toBeVisible();

    // A second draft can be discarded
    await bp.goto(convUrl);
    await man.getByLabel(/^Draft type/).selectOption("strategy_note");
    await man
      .getByLabel(/^Draft$/)
      .fill("Lead with real guest stories rather than discounts.");
    await man.getByRole("button", { name: "Save draft" }).click();
    await expect(
      man.getByText("Draft saved. Approve it when you are ready."),
    ).toBeVisible();
    await bp.reload();
    await bp
      .getByRole("article", { name: "Strategy note draft" })
      .getByRole("button", { name: "Discard" })
      .click();
    await expect(
      bp.getByRole("article", { name: "Strategy note draft" }),
    ).toHaveCount(0);

    // Usage did not move while offline
    await bp.goto(`/brand/assistant?w=${w}`);
    await expect(bp.getByText("0 of 100")).toBeVisible();
    await expect(bp.getByRole("link", { name: "First month" })).toBeVisible();
    await bp.screenshot({
      path: `${shots}/assistant-home-desktop.png`,
      fullPage: true,
    });

    // Settings: sources and opt-in memory, then delete memory
    await bp.getByRole("link", { name: "Settings and memory" }).click();
    const set = bp.getByRole("form", { name: "Assistant settings" });
    await set.getByLabel("Remember our team's preferences").check();
    await set
      .getByLabel(/^Team preferences/)
      .fill("Short, practical steps. No discounts below 10%.");
    await set.getByLabel("Indicative budget").check();
    await set.getByRole("button", { name: "Save settings" }).click();
    await expect(set.getByText("Settings saved.")).toBeVisible();
    await bp.screenshot({
      path: `${shots}/settings-desktop.png`,
      fullPage: true,
    });
    await bp.goto(convUrl);
    await bp.getByText(/What will be shared/).click();
    await expect(bp.locator(".ba-context pre")).toContainText(
      "No discounts below 10%",
    );
    await bp.goto(`/brand/assistant/settings?w=${w}`);
    const del = bp.getByRole("form", { name: "Delete memory" });
    await del.getByRole("button", { name: "Delete memory" }).click();
    await expect(del.getByText("Memory deleted.")).toBeVisible();
    await bp.goto(convUrl);
    await bp.getByText(/What will be shared/).click();
    await expect(bp.locator(".ba-context pre")).not.toContainText(
      "No discounts below 10%",
    );

    // Another Brand cannot open this conversation
    const o = await browser.newContext();
    await signedIn(o, other);
    const op = await o.newPage();
    await onboard(op, other.workspace_id, "Other Brand Co");
    const id = new URL(convUrl).pathname.split("/").pop();
    expect(
      (
        await op.goto(`/brand/assistant/${id}?w=${other.workspace_id}`)
      )?.status(),
    ).toBe(404);
    await expect(op.getByText("Coastline Hostels")).toHaveCount(0);

    // Accessibility and overflow
    for (const p of [
      `/brand/assistant?w=${w}`,
      convUrl.replace(/^https?:\/\/[^/]+/, ""),
      `/brand/assistant/settings?w=${w}`,
    ])
      await overflowAndAxe(bp, p);
    await bp.setViewportSize({ width: 390, height: 844 });
    await bp.goto(convUrl);
    await bp.screenshot({
      path: `${shots}/conversation-mobile.png`,
      fullPage: true,
    });

    // Delete the conversation
    await bp.setViewportSize({ width: 1280, height: 800 });
    await bp.goto(convUrl);
    await bp.getByRole("button", { name: "Delete conversation" }).click();
    await expect(bp.getByText("Conversation deleted.")).toBeVisible();
    await expect(bp.getByRole("link", { name: "First month" })).toHaveCount(0);
    await b.close();
    await o.close();
  });
});
