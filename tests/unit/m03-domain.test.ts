import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { account, state } from "./creator-fixtures";
import {
  evaluateEligibility,
  followerSegment,
  bestIndividualFollowers,
} from "@/features/creator-onboarding/eligibility";
import { parseSection } from "@/features/creator-onboarding/schemas";
import { validateProfileUrl } from "@/features/creator-onboarding/social-url";
import {
  validateScreenshot,
  validateScreenshotContent,
  screenshotUploadsEnabled,
} from "@/features/creator-onboarding/evidence";
import { toMinor, fromMinor } from "@/features/creator-onboarding/money";
import {
  generateInitialPlan,
  planDisclosure,
} from "@/features/creator-onboarding/plan";
import {
  buildChecklist,
  checklistSummary,
} from "@/features/creator-onboarding/checklist";
import {
  recommend,
  noPublishedOpportunities,
} from "@/features/creator-onboarding/recommendations";
import { aiAvailability } from "@/features/creator-onboarding/ai";
import {
  canActivate,
  missingMandatory,
  nextStep,
  stepStatus,
} from "@/features/creator-onboarding/progress";
import {
  challengeCodes,
  industryCodes,
  nicheCodes,
} from "@/features/creator-onboarding/taxonomy";

const elig = (accounts = [account()], extra = {}) =>
  evaluateEligibility(state({ social_accounts: accounts, ...extra }));
const f = (n: number | null, o = {}) =>
  account({
    self_reported_followers: n,
    observed_on: n === null ? null : "2026-11-01",
    ...o,
  });

describe("M03 eligibility engine (F01, AC02)", () => {
  it("zero followers: not eligible, growth tools still available after activation", () => {
    const e = evaluateEligibility(
      state({
        social_accounts: [f(0)],
        profile: { ...state().profile!, activated_at: "2026-11-25T00:00:00Z" },
      }),
    );
    expect(e.standardInfluencer.status).toBe("not_yet");
    expect(e.growthTools.status).toBe("available");
    expect(e.workspaceActivation.status).toBe("active");
  });
  it("99 followers does not qualify; 100 does", () => {
    expect(elig([f(99)]).standardInfluencer.status).toBe("not_yet");
    expect(elig([f(100)]).standardInfluencer.status).toBe(
      "meets_follower_rule_unverified",
    );
  });
  it("never adds followers across accounts (60 + 60 does not qualify)", () => {
    const e = elig([
      f(60, { handle: "a" }),
      f(60, { handle: "b", platform: "youtube", account_type: null }),
    ]);
    expect(e.standardInfluencer.status).toBe("not_yet");
    expect(bestIndividualFollowers([f(60), f(60, { handle: "b" })])).toBe(60);
  });
  it("a Brand or company page does not count as an individual account", () => {
    expect(
      elig([f(5000, { ownership_scope: "brand_or_company" })])
        .standardInfluencer.status,
    ).toBe("not_yet");
  });
  it("activation and eligibility are independent: not activated yet still gets the follower result, and no accounts still activates", () => {
    const none = evaluateEligibility(
      state({
        profile: { ...state().profile!, activated_at: "2026-11-25T00:00:00Z" },
      }),
    );
    expect(none.workspaceActivation.status).toBe("active");
    expect(none.standardInfluencer.status).toBe("not_yet");
    expect(elig([f(500)]).workspaceActivation.status).toBe("not_active");
  });
  it("unknown follower counts stay unknown, not zero", () => {
    expect(elig([f(null)]).standardInfluencer.status).toBe(
      "needs_account_info",
    );
    expect(followerSegment([f(null)])).toBe("unknown");
  });
  it("qualifying accounts are still labelled unverified and never commercially verified", () => {
    const e = elig([f(5000)]);
    expect(e.socialOwnership.status).toBe("unverified");
    expect(e.commercialVerification.status).toBe(
      "required_before_commercial_activity",
    );
    expect(JSON.stringify(e)).not.toMatch(/commercially verified/i);
  });
  it("UGC is assessed separately and needs no follower count or invented score", () => {
    const e = evaluateEligibility(
      state({ collaborations: [{ category: "ugc", interested: true }] }),
    );
    expect(e.ugc.status).toBe("needs_assessment");
    expect(e.standardInfluencer.status).toBe("not_yet");
    expect(JSON.stringify(e.ugc)).not.toMatch(/score|\d+ followers/i);
  });
  it("campaign-specific requirements are deferred to the campaign module", () => {
    expect(elig().campaignSpecific.status).toBe("determined_per_campaign");
  });
  it("maps the approved follower segments", () => {
    const seg = (n: number) => followerSegment([f(n)]);
    expect([
      seg(0),
      seg(99),
      seg(100),
      seg(999),
      seg(1000),
      seg(4999),
      seg(5000),
      seg(9999),
      seg(10000),
      seg(19999),
      seg(20000),
    ]).toEqual([
      "none_or_under_100",
      "none_or_under_100",
      "100_999",
      "100_999",
      "1k_4999",
      "1k_4999",
      "5k_9999",
      "5k_9999",
      "10k_19999",
      "10k_19999",
      "20k_plus",
    ]);
    expect(followerSegment([])).toBe("none_or_under_100");
  });
});

describe("M03 input validation", () => {
  const social = (accounts: unknown[], none = false) =>
    parseSection("social", { none, accounts });
  it("accepts a personal Instagram account, a private account, and multiple accounts on one platform with one primary (F04–F06)", () => {
    const r = social([
      {
        platform: "instagram",
        handle: "@asha",
        account_type: "personal",
        visibility: "private",
        self_reported_followers: "60",
        is_primary: true,
      },
      {
        platform: "instagram",
        handle: "asha.work",
        account_type: "creator",
        visibility: "public",
      },
      { platform: "youtube", handle: "asha" },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const accounts = (r.data as { accounts: Record<string, unknown>[] })
        .accounts;
      expect(accounts).toHaveLength(3);
      expect(accounts.filter((a) => a.is_primary)).toHaveLength(1);
      expect(accounts[0].handle).toBe("asha");
      expect(accounts[0].observed_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(accounts[1].self_reported_followers).toBeNull();
    }
  });
  it("assigns a primary when exactly one account is added, and rejects two primaries", () => {
    const r = social([{ platform: "other", handle: "x" }]);
    expect(
      r.ok &&
        (r.data as { accounts: { is_primary: boolean }[] }).accounts[0]
          .is_primary,
    ).toBe(true);
    expect(
      social([
        { platform: "other", handle: "a", is_primary: true },
        { platform: "other", handle: "b", is_primary: true },
      ]).ok,
    ).toBe(false);
  });
  it("enforces the 10 account limit and rejects duplicates", () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({
      platform: "other",
      handle: "h" + i,
    }));
    expect(social(ten).ok).toBe(true);
    expect(social([...ten, { platform: "other", handle: "h11" }]).ok).toBe(
      false,
    );
    expect(
      social([
        { platform: "other", handle: "dup" },
        { platform: "other", handle: "DUP" },
      ]).ok,
    ).toBe(false);
  });
  it("the no-account path is valid and clears accounts", () => {
    const r = social([{ platform: "other", handle: "ignored" }], true);
    expect(r).toEqual({ ok: true, data: { none: true, accounts: [] } });
  });
  it("rejects invalid or unsafe social URLs", () => {
    for (const bad of [
      "javascript:alert(1)",
      "http://instagram.com/a",
      "https://localhost/a",
      "https://127.0.0.1/x",
      "https://user:pw@instagram.com/a",
      "https://instagram.com:8080/a",
      "https://evil.example/a",
      "data:text/html,x",
      "//instagram.com/a",
      "https://10.0.0.1/",
    ])
      expect(validateProfileUrl("instagram", bad).ok, bad).toBe(false);
    expect(
      validateProfileUrl("instagram", "https://www.instagram.com/asha").ok,
    ).toBe(true);
    expect(validateProfileUrl("other", "https://example.com/me").ok).toBe(true);
    expect(
      social([
        {
          platform: "instagram",
          handle: "a",
          profile_url: "javascript:alert(1)",
        },
      ]).ok,
    ).toBe(false);
  });
  it("requires a primary niche unless exploring; custom niches need a label (F08)", () => {
    expect(parseSection("niche", {}).ok).toBe(false);
    expect(parseSection("niche", { exploring: true }).ok).toBe(true);
    expect(parseSection("niche", { primary: { code: "custom" } }).ok).toBe(
      false,
    );
    expect(
      parseSection("niche", {
        primary: { code: "custom", custom_label: "Urban gardening" },
        secondary: [{ code: "food" }],
      }).ok,
    ).toBe(true);
    expect(parseSection("niche", { primary: { code: "not-a-niche" } }).ok).toBe(
      false,
    );
  });
  it("goals: numeric targets can be deferred; unknown baselines are not invented (F10)", () => {
    const r = parseSection("goals", {
      goals: [
        { category: "audience_growth" },
        {
          category: "audience_growth",
          metric: "follower_count",
          target: "500",
          timeframe_days: "90",
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const g = (r.data as { goals: Record<string, unknown>[] }).goals;
      expect(g[0]).toMatchObject({
        metric: null,
        baseline_kind: "unknown",
        baseline_value: null,
        target_value: null,
      });
      expect(g[1]).toMatchObject({
        metric: "follower_count",
        baseline_kind: "unknown",
        baseline_value: null,
        target_value: 500,
      });
    }
    expect(parseSection("goals", { goals: [] }).ok).toBe(false);
    expect(
      parseSection("goals", {
        goals: [{ category: "monetization", target: "-5" }],
      }).ok,
    ).toBe(false);
  });
  it("preferences: all six categories stored, exclusions take precedence over positives (F12, F15)", () => {
    const r = parseSection("preferences", {
      collaborations: ["ugc", "affiliate"],
      preferred: ["alcohol", "food_beverage"],
      considering: ["gaming"],
      exclusions: [{ industry: "alcohol" }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const d = r.data as {
        collaborations: { category: string; interested: boolean }[];
        industries: { industry: string }[];
        exclusions: { industry: string }[];
      };
      expect(d.collaborations).toHaveLength(6);
      expect(
        d.collaborations
          .filter((c) => c.interested)
          .map((c) => c.category)
          .sort(),
      ).toEqual(["affiliate", "ugc"]);
      expect(d.industries.map((i) => i.industry)).toEqual([
        "food_beverage",
        "gaming",
      ]);
      expect(d.exclusions[0].industry).toBe("alcohol");
    }
    expect(parseSection("preferences", {}).ok).toBe(true); // growth-only is valid
  });
  it("rates use integer minor units, default INR, and unsure rates carry no amount (F13, F14)", () => {
    const r = parseSection("rates", {
      rates: [
        { format: "short_video", amount: "2,500.50" },
        { format: "story", amount: "100", unsure: true },
        { format: "carousel", amount: "" },
      ],
    });
    expect(
      r.ok && (r.data as { rates: Record<string, unknown>[] }).rates,
    ).toEqual([
      {
        format: "short_video",
        amount_minor: 250050,
        currency: "INR",
        negotiable: true,
        unsure: false,
      },
      {
        format: "story",
        amount_minor: null,
        currency: "INR",
        negotiable: true,
        unsure: true,
      },
      {
        format: "carousel",
        amount_minor: null,
        currency: "INR",
        negotiable: true,
        unsure: false,
      },
    ]);
    expect(
      parseSection("rates", { rates: [{ format: "story", amount: "abc" }] }).ok,
    ).toBe(false);
    expect(toMinor("12.5")).toBe(1250);
    expect(toMinor("0.999")).toBeNull();
    expect(fromMinor(250050)).toBe("2500.50");
  });
  it("identity and resources validate; resources never ask for bank details (F11)", () => {
    expect(
      parseSection("identity", {
        display_name: "",
        country: "IN",
        language: "en",
        stage: "aspiring",
      }).ok,
    ).toBe(false);
    expect(
      parseSection("identity", {
        display_name: "Asha",
        country: "IN",
        language: "en",
        stage: "aspiring",
      }).ok,
    ).toBe(true);
    expect(parseSection("resources", { hours_per_week: "200" }).ok).toBe(false);
    expect(
      parseSection("resources", { equipment: ["smartphone"], budget: "0" }).ok,
    ).toBe(true);
    expect(parseSection("resources", { equipment: ["bank_account"] }).ok).toBe(
      false,
    );
  });
});

describe("M03 screenshot evidence validation", () => {
  const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0,
  ]);
  const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0]);
  it("uploads are disabled until private storage and scanning exist", () => {
    expect(screenshotUploadsEnabled).toBe(false);
    expect(
      validateScreenshot(
        { size: 100, declaredMime: "image/png", head: png },
        "id",
      ).ok,
    ).toBe(false);
  });
  it("accepts a genuine image and rejects malicious or mismatched attachments", () => {
    expect(
      validateScreenshotContent(
        { size: 100, declaredMime: "image/png", head: png },
        "abc",
      ),
    ).toEqual({ ok: true, mime: "image/png", storedName: "abc.png" });
    expect(
      validateScreenshotContent(
        { size: 100, declaredMime: "image/png", head: exe },
        "a",
      ).ok,
    ).toBe(false); // executable renamed .png
    expect(
      validateScreenshotContent(
        {
          size: 100,
          declaredMime: "image/svg+xml",
          head: new TextEncoder().encode("<svg onload=alert(1)>"),
        },
        "a",
      ).ok,
    ).toBe(false);
    expect(
      validateScreenshotContent(
        { size: 100, declaredMime: "image/jpeg", head: png },
        "a",
      ).ok,
    ).toBe(false); // MIME mismatch
    expect(
      validateScreenshotContent(
        { size: 6 * 1024 * 1024, declaredMime: "image/png", head: png },
        "a",
      ).ok,
    ).toBe(false);
    expect(
      validateScreenshotContent(
        { size: 0, declaredMime: "image/png", head: png },
        "a",
      ).ok,
    ).toBe(false);
  });
  it("never puts a user-supplied filename in the storage path", () => {
    const r = validateScreenshotContent(
      { size: 10, declaredMime: "image/png", head: png },
      "3f2b",
    );
    expect(r.ok && r.storedName).toBe("3f2b.png");
  });
});

describe("M03 growth plan, checklist and recommendations (F19)", () => {
  const goalsState = (goals: string[]) =>
    goals.map((category) => ({
      category,
      metric: null,
      baseline_kind: "unknown" as const,
      baseline_value: null,
      target_value: null,
      currency: null,
      timeframe_days: null,
      details: null,
    }));
  it("aspiring creator without accounts gets a practical 5–7 action plan within seven days", () => {
    const p = generateInitialPlan(
      state({
        goals: goalsState(["audience_growth"]),
        niches: [{ role: "primary", code: "food", custom_label: null }],
      }),
    );
    expect(p.actions.length).toBeGreaterThanOrEqual(5);
    expect(p.actions.length).toBeLessThanOrEqual(7);
    expect(p.actions.every((a) => a.day >= 1 && a.day <= 7)).toBe(true);
    expect(p.actions[0].title).toMatch(/themes within Food/);
    expect(p.actions.map((a) => a.title).join(" ")).toMatch(/platform/i);
    expect(p.basis).toMatchObject({
      generated_by: "rule_based",
      has_account: false,
      niche: "Food",
    });
  });
  it("existing creators get review-oriented actions, and guidance reflects actual goals and constraints", () => {
    const base = state({
      profile: { ...state().profile!, stage: "growing" },
      social_accounts: [f(1500)],
      goals: goalsState(["consistency", "monetization"]),
      challenges: [{ code: "consistency", detail: null }],
      resources: {
        hours_per_week: 2,
        posts_per_week: 1,
        equipment: [],
        budget_minor: null,
        budget_currency: null,
      },
    });
    const p = generateInitialPlan(base);
    const text = p.actions.map((a) => a.title + " " + a.detail).join(" ");
    expect(text).toMatch(/Review your last few posts/);
    expect(text).toMatch(/1 post a week/);
    expect(text).toMatch(/routine/i);
    expect(text).toMatch(/eligibility/i);
    expect(p.basis).toMatchObject({
      follower_segment: "1k_4999",
      goals: ["Content consistency", "Monetization"],
    });
  });
  it("plan text never promises outcomes or claims AI", () => {
    const all = JSON.stringify(
      generateInitialPlan(state({ goals: goalsState(["monetization"]) })),
    );
    expect(all).not.toMatch(/guarantee|will earn|\bAI\b|viral|₹|\$\d/i);
    expect(planDisclosure).toMatch(/not AI-generated/);
  });
  it("checklist is derived from persisted data; skipped optional items are not penalized and nothing is scored", () => {
    const s = state({
      onboarding: {
        revision: 3,
        current_step: "review",
        ai_assisted: false,
        steps: {
          identity: "completed",
          niche: "completed",
          goals: "completed",
          social: "skipped",
        },
      },
      niches: [{ role: "primary", code: "food", custom_label: null }],
      goals: goalsState(["engagement"]),
    });
    const items = buildChecklist(s);
    expect(items.find((i) => i.id === "social")?.state).toBe("skipped");
    expect(items.find((i) => i.id === "challenges")?.state).toBe("todo");
    expect(
      items
        .filter((i) => i.group === "required")
        .every((i) => i.state === "done"),
    ).toBe(true);
    const sum = checklistSummary(items);
    expect(sum).toMatchObject({
      requiredDone: 3,
      requiredTotal: 3,
      optionalAddressed: 1,
    });
    expect(JSON.stringify(sum)).not.toMatch(/score|quality/i);
    expect(
      items
        .filter((i) => i.group === "later")
        .every((i) => i.state === "unavailable" && i.href === null),
    ).toBe(true);
  });
  it("recommendations: no invented campaigns when nothing is published; honest empty state with preparation actions", async () => {
    const published = await noPublishedOpportunities.listPublished();
    const r = recommend(state(), published);
    expect(r.empty).toBe(true);
    expect(r.opportunities).toEqual([]);
    expect(r.preparation.length).toBeGreaterThan(0);
    expect(JSON.stringify(r)).not.toMatch(/₹|\$|earn|sponsor/i);
  });
  it("recommendations never include excluded industries and rank by niche and platform (AC04)", () => {
    const s = state({
      industry_exclusions: [{ industry: "alcohol", note: null }],
      niches: [{ role: "primary", code: "food", custom_label: null }],
      social_accounts: [f(200, { platform: "instagram" })],
    });
    const r = recommend(s, [
      {
        id: "1",
        title: "A",
        industry: "alcohol",
        category: "barter",
        niche: "food",
      },
      { id: "2", title: "B", industry: "food_beverage", category: "barter" },
      {
        id: "3",
        title: "C",
        industry: "food_beverage",
        category: "barter",
        niche: "food",
        platform: "instagram",
      },
    ]);
    expect(r.opportunities.map((o) => o.id)).toEqual(["3", "2"]);
    expect(r.excludedCount).toBe(1);
  });
  it("private goals and challenges never appear in recommendation output", () => {
    const s = state({
      goals: goalsState(["monetization"]),
      challenges: [{ code: "negotiation", detail: "private detail" }],
    });
    expect(JSON.stringify(recommend(s, []))).not.toMatch(
      /private detail|monetization/,
    );
  });
});

describe("M03 progress, AI contract and taxonomy", () => {
  it("distinguishes unanswered from skipped and resumes at the first unanswered step (AC03)", () => {
    const s = state({
      onboarding: {
        revision: 2,
        current_step: "social",
        ai_assisted: false,
        steps: { identity: "completed", social: "skipped" },
      },
    });
    expect(stepStatus(s, "social")).toBe("skipped");
    expect(stepStatus(s, "niche")).toBe("unanswered");
    expect(nextStep(s)).toBe("niche");
  });
  it("activation needs only identity, niche (or exploring) and a goal", () => {
    expect(missingMandatory(state())).toEqual(["niche", "goals"]);
    const ok = state({
      profile: { ...state().profile!, niche_exploring: true },
      goals: [
        {
          category: "ugc",
          metric: null,
          baseline_kind: "unknown",
          baseline_value: null,
          target_value: null,
          currency: null,
          timeframe_days: null,
          details: null,
        },
      ],
    });
    expect(canActivate(ok)).toBe(true);
    expect(ok.social_accounts).toHaveLength(0);
  });
  it("the AI path is reported unavailable without a provider and never simulates a conversation", () => {
    const a = aiAvailability();
    expect(a.available).toBe(false);
    expect(a.available === false && a.reason).toMatch(/not available/);
  });
  it("taxonomy codes match the database reference seeds", () => {
    const sql = readFileSync(
      "supabase/migrations/20261126000100_m03_creator_onboarding.sql",
      "utf8",
    );
    const seeds = (table: string) =>
      [
        ...sql
          .split(`insert into aura_creator.${table}(code,label) values`)[1]
          .split(";")[0]
          .matchAll(/\('([a-z_]+)'/g),
      ]
        .map((m) => m[1])
        .sort();
    expect(seeds("niche_ref")).toEqual([...nicheCodes].sort());
    expect(seeds("industry_ref")).toEqual([...industryCodes].sort());
    expect(seeds("challenge_ref")).toEqual([...challengeCodes].sort());
  });
});
