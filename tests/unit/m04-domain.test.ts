import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { account, state } from "./creator-fixtures";
import type { CreatorState, Goal } from "@/features/creator-onboarding/types";
import { areas, areaFor, isInternalPath } from "@/features/creator-studio/nav";
import {
  essentialNotices,
  headline,
  situationOf,
  widgetOrder,
} from "@/features/creator-studio/personalization";
import {
  candidates,
  generateDailyActions,
  toPayload,
  type ActionInput,
} from "@/features/creator-studio/daily-actions";
import {
  chartable,
  evaluateGoal,
  evaluateGoals,
  insights,
} from "@/features/creator-studio/goals";
import { describeWeek } from "@/features/creator-studio/weekly";
import { unavailableCommercial } from "@/features/creator-studio/commercial";
import {
  assistantAvailability,
  assistantManualTools,
} from "@/features/creator-studio/assistant";
import {
  normalizeQuery,
  searchCatalogues,
  searchOwnProfile,
  unsearchedModules,
} from "@/features/creator-studio/search";
import { describeEvent } from "@/features/creator-studio/events";
import {
  defaultPrefs,
  ideaSchema,
  observationSchema,
  prefsSchema,
} from "@/features/creator-studio/schemas";
import type { Observation, WeekSummary } from "@/features/creator-studio/types";

// --- route resolution: every internal href in config must match a real page file ---
function pages(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) pages(p, out);
    else if (f === "page.tsx") out.push(p);
  }
  return out;
}
const routes = pages("src/app").map(
  (p) =>
    p
      .replace(/^src\/app/, "")
      .replace(/\/page\.tsx$/, "")
      .split("/")
      .filter((s) => !/^\(.*\)$/.test(s))
      .join("/") || "/",
);
const routeExists = (href: string) => {
  const path = href.split(/[#?]/)[0];
  return routes.some((r) =>
    new RegExp("^" + r.replace(/\[[^\]]+\]/g, "[^/]+") + "$").test(path),
  );
};

const goal = (o: Partial<Goal> = {}): Goal => ({
  category: "audience_growth",
  metric: "follower_count",
  baseline_kind: "self_reported",
  baseline_value: 40,
  target_value: 140,
  currency: null,
  timeframe_days: 90,
  details: null,
  ...o,
});
const obs = (
  value: number,
  observed_on: string,
  o: Partial<Observation> = {},
): Observation => ({
  id: crypto.randomUUID(),
  category: "audience_growth",
  metric: "follower_count",
  value,
  observed_on,
  source: "self_reported",
  note: null,
  created_at: observed_on + "T09:00:00Z",
  ...o,
});
const withPlan = (s: CreatorState): CreatorState => ({
  ...s,
  plan: {
    id: "p",
    version: 1,
    label: "rule_based_initial_guidance",
    basis: {},
    created_at: "2026-11-01T00:00:00Z",
    actions: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        position: 1,
        day: 1,
        title: "Pick themes",
        detail: "List three",
        status: "todo",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        position: 2,
        day: 2,
        title: "Choose a platform",
        detail: "One only",
        status: "todo",
      },
    ],
  },
});
const input = (s: CreatorState, o: Partial<ActionInput> = {}): ActionInput => ({
  state: s,
  ideasTotal: 0,
  lastIdeaDaysAgo: null,
  observations: [],
  today: "2026-11-25",
  isoWeekday: 3,
  recentCompleted: new Set(),
  hasClosedReview: false,
  ...o,
});
const f = (n: number, o = {}) =>
  account({ self_reported_followers: n, observed_on: "2026-11-01", ...o });

describe("M04 navigation (F03, F04, F31)", () => {
  it("has exactly the five approved primary areas", () =>
    expect(areas.map((a) => a.label)).toEqual([
      "Home",
      "Grow",
      "Create",
      "Collaborate",
      "My Studio",
    ]));
  it("every available destination resolves to a real route; planned ones have no link", () => {
    for (const a of areas) {
      expect(routeExists(a.href), a.href).toBe(true);
      for (const i of a.items) {
        if (i.status === "available")
          expect(i.href && routeExists(i.href), `${i.id} ${i.href}`).toBe(true);
        else {
          expect(i.href, i.id).toBeNull();
          expect(i.note, i.id).toBeTruthy();
        }
      }
    }
  });
  it("each primary area has meaningful current functionality", () => {
    for (const a of areas)
      expect(
        a.items.some((i) => i.status === "available"),
        a.id,
      ).toBe(true);
  });
  it("maps pathnames to the active area", () => {
    expect(areaFor("/creator/dashboard")).toBe("home");
    expect(areaFor("/creator/actions")).toBe("grow");
    expect(areaFor("/creator/progress")).toBe("grow");
    expect(areaFor("/creator/create")).toBe("create");
    expect(areaFor("/creator/recommendations")).toBe("collaborate");
    expect(areaFor("/creator/settings/dashboard")).toBe("studio");
  });
  it("only allows internal paths", () => {
    for (const bad of [
      "//evil.example",
      "https://evil.example",
      "javascript:alert(1)",
      "/a b",
      "evil",
    ])
      expect(isInternalPath(bad), bad).toBe(false);
    expect(isInternalPath("/creator/actions#x")).toBe(true);
  });
});

describe("M04 personalization (F05, F16, AC01)", () => {
  it("classifies the four account situations from real data", () => {
    expect(situationOf(state())).toBe("no_accounts");
    expect(situationOf(state({ social_accounts: [f(60)] }))).toBe("below_100");
    expect(situationOf(state({ social_accounts: [account()] }))).toBe(
      "counts_unknown",
    );
    expect(situationOf(state({ social_accounts: [f(150)] }))).toBe(
      "qualifying",
    );
    expect(
      situationOf(
        state({
          social_accounts: [f(60, { handle: "a" }), f(60, { handle: "b" })],
        }),
      ),
    ).toBe("below_100"); // never summed
    expect(
      situationOf(
        state({
          social_accounts: [f(9000, { ownership_scope: "brand_or_company" })],
        }),
      ),
    ).toBe("below_100");
  });
  it("puts growth first and commercial after growth widgets in every situation", () => {
    for (const s of [
      state(),
      state({ social_accounts: [f(60)] }),
      state({ social_accounts: [account()] }),
      state({ social_accounts: [f(500)] }),
    ]) {
      const o = widgetOrder(s);
      expect(o[0]).toBe("actions");
      for (const g of ["actions", "goals", "plan"] as const)
        expect(
          o.indexOf("commercial"),
          `${situationOf(s)} ${g}`,
        ).toBeGreaterThan(o.indexOf(g));
    }
    expect(widgetOrder(state()).slice(0, 3)).toEqual([
      "actions",
      "plan",
      "content",
    ]);
  });
  it("respects hidden widgets and the gamification switch, and keeps essential notices unhideable", () => {
    const s = state({ social_accounts: [f(60)] });
    expect(widgetOrder(s, ["commercial", "weekly"])).not.toContain(
      "commercial",
    );
    expect(widgetOrder(s, [], false)).not.toContain("milestones");
    expect(essentialNotices(s).map((n) => n.id)).toEqual([
      "private",
      "unverified",
    ]);
    expect(essentialNotices(state()).map((n) => n.id)).toEqual(["private"]);
  });
  it("moves recommendations up for UGC-focused Creators without granting anything", () => {
    const ugc = state({
      profile: { ...state().profile!, stage: "ugc_focused" },
    });
    expect(widgetOrder(ugc).indexOf("recommendations")).toBeLessThan(
      widgetOrder(state()).indexOf("recommendations"),
    );
  });
  it("headlines never claim AI or guarantees", () => {
    for (const s of [state(), state({ social_accounts: [f(500)] })])
      expect(headline(s)).not.toMatch(/\bAI\b|guarantee|will earn/i);
  });
});

describe("M04 daily action engine (F06, F13)", () => {
  it("always returns three to five distinct actions, even with almost no data", () => {
    for (const s of [
      state(),
      withPlan(
        state({
          goals: [
            {
              ...goal(),
              metric: null,
              baseline_kind: "unknown",
              baseline_value: null,
              target_value: null,
            },
          ],
        }),
      ),
    ]) {
      const a = generateDailyActions(input(s));
      expect(a.length).toBeGreaterThanOrEqual(3);
      expect(a.length).toBeLessThanOrEqual(5);
      expect(new Set(a.map((x) => x.rule_key)).size).toBe(a.length);
    }
  });
  it("is deterministic for identical input", () => {
    const s = withPlan(state({ goals: [goal()] }));
    expect(generateDailyActions(input(s))).toEqual(
      generateDailyActions(input(s)),
    );
  });
  it("leads with the next M03 plan action and links it", () => {
    const a = generateDailyActions(input(withPlan(state())));
    expect(a[0]).toMatchObject({
      category: "growth_plan",
      plan_action_id: "11111111-1111-4111-8111-111111111111",
      title: "Pick themes",
    });
  });
  it("reflects real goals and challenges", () => {
    const s = state({
      goals: [
        goal(),
        {
          ...goal({
            category: "consistency",
            metric: "posts_per_week",
            baseline_value: null,
            baseline_kind: "unknown",
            target_value: 3,
          }),
        },
      ],
      challenges: [
        { code: "content_ideas", detail: null },
        { code: "consistency", detail: null },
      ],
    });
    const keys = generateDailyActions(input(s)).map((x) => x.rule_key);
    expect(keys).toContain("idea");
    expect(keys).toContain("schedule");
    expect(keys.some((k) => k.startsWith("observe:"))).toBe(true);
  });
  it("labels dependencies on unbuilt modules and links only to real routes", () => {
    const s = state({
      goals: [goal({ category: "consistency", metric: null })],
      collaborations: [
        { category: "ugc", interested: true },
        { category: "paid_influencer", interested: true },
      ],
      profile: { ...state().profile!, stage: "ugc_focused" },
    });
    const all = candidates(input(s));
    expect(all.find((x) => x.rule_key === "schedule")?.dependency).toBe("M08");
    expect(all.find((x) => x.rule_key === "ugc_prep")?.dependency).toBe("M09");
    for (const x of all)
      if (x.href) {
        expect(isInternalPath(x.href), x.href).toBe(true);
        expect(routeExists(x.href), x.href).toBe(true);
      }
  });
  it("only asks for an observation when none is recent, and never invents one", () => {
    const s = state({ goals: [goal()] });
    expect(
      candidates(input(s)).some((x) => x.rule_key.startsWith("observe:")),
    ).toBe(true);
    expect(
      candidates(input(s, { observations: [obs(60, "2026-11-23")] })).some(
        (x) => x.rule_key.startsWith("observe:"),
      ),
    ).toBe(false);
    expect(
      candidates(input(s, { observations: [obs(60, "2026-11-10")] })).find(
        (x) => x.rule_key.startsWith("observe:"),
      )?.detail,
    ).toMatch(/15 days ago/);
  });
  it("does not nag about optional sections the Creator deliberately skipped", () => {
    const s = state({
      onboarding: {
        revision: 1,
        current_step: "review",
        ai_assisted: false,
        steps: {
          social: "skipped",
          challenges: "skipped",
          preferences: "skipped",
          resources: "skipped",
          rates: "skipped",
        },
      },
    });
    expect(
      candidates(input(s)).some((x) => x.rule_key.startsWith("profile:")),
    ).toBe(false);
    expect(
      candidates(input(state())).some((x) => x.rule_key.startsWith("profile:")),
    ).toBe(true);
  });
  it("rotates recently completed rules out but keeps plan actions", () => {
    const s = withPlan(state());
    const a = generateDailyActions(
      input(s, {
        recentCompleted: new Set([
          "idea",
          "plan:11111111-1111-4111-8111-111111111111",
        ]),
      }),
    );
    expect(a.map((x) => x.rule_key)).not.toContain("idea");
    expect(a[0].category).toBe("growth_plan");
  });
  it("raises UGC preparation for UGC-focused Creators so the segment really shapes the day", () => {
    const base = state({
      goals: [
        goal({
          category: "ugc",
          metric: null,
          baseline_kind: "unknown",
          baseline_value: null,
          target_value: null,
        }),
      ],
      collaborations: [{ category: "ugc", interested: true }],
    });
    const ugc = {
      ...base,
      profile: { ...base.profile!, stage: "ugc_focused" },
    };
    expect(generateDailyActions(input(ugc)).map((x) => x.rule_key)).toContain(
      "ugc_prep",
    );
    expect(
      generateDailyActions(input(ugc)).find((x) => x.rule_key === "ugc_prep")
        ?.dependency,
    ).toBe("M09");
  });
  it("offers the weekly review reminder only on Mondays with a real closed review", () => {
    expect(
      candidates(input(state(), { isoWeekday: 1, hasClosedReview: true })).some(
        (x) => x.rule_key === "weekly_review",
      ),
    ).toBe(true);
    expect(
      candidates(
        input(state(), { isoWeekday: 1, hasClosedReview: false }),
      ).some((x) => x.rule_key === "weekly_review"),
    ).toBe(false);
    expect(
      candidates(input(state(), { isoWeekday: 3, hasClosedReview: true })).some(
        (x) => x.rule_key === "weekly_review",
      ),
    ).toBe(false);
  });
  it("produces a payload the database accepts (no internal fields) and no invented metrics", () => {
    const p = toPayload(
      generateDailyActions(input(withPlan(state({ goals: [goal()] })))),
    );
    expect(Object.keys(p[0]).sort()).toEqual([
      "category",
      "dependency",
      "detail",
      "href",
      "plan_action_id",
      "rule_key",
      "title",
    ]);
    expect(JSON.stringify(p)).not.toMatch(/\d+ followers|earn|₹|\$\d/i);
    for (const x of p) expect(x.rule_key).toMatch(/^[a-z0-9_.:-]{1,60}$/);
  });
});

describe("M04 goal tracking (F10, F16, AC03)", () => {
  const today = "2026-11-25";
  it("computes progress from a known baseline", () => {
    const v = evaluateGoal(goal(), [obs(90, "2026-11-20")], today);
    expect(v.progress).toEqual({
      kind: "from_baseline",
      fraction: 0.5,
      percent: 50,
    });
    expect(v.source).toBe("Self-reported");
    expect(v.freshness).toBe("fresh");
  });
  it("never invents a baseline: a missing baseline shows latest against target and no percentage", () => {
    const v = evaluateGoal(
      goal({ baseline_kind: "unknown", baseline_value: null }),
      [obs(30, "2026-11-20")],
      today,
    );
    expect(v.baseline).toBeNull();
    expect(v.progress).toEqual({ kind: "of_target", latest: 30, target: 140 });
  });
  it("treats a recorded zero as a real value and no observation as unknown", () => {
    const zero = evaluateGoal(
      goal({ baseline_kind: "unknown", baseline_value: null }),
      [obs(0, "2026-11-24")],
      today,
    );
    expect(zero.latest?.value).toBe(0);
    expect(zero.status).toBe("tracking");
    const none = evaluateGoal(goal(), [], today);
    expect(none.status).toBe("no_observation");
    expect(none.latest).toBeNull();
    expect(none.progress.kind).toBe("none");
    expect(none.source).toBeNull();
  });
  it("marks goals without a measure and stale observations honestly", () => {
    expect(
      evaluateGoal(
        goal({
          metric: null,
          baseline_value: null,
          baseline_kind: "unknown",
          target_value: null,
        }),
        [],
        today,
      ).status,
    ).toBe("no_measure");
    expect(evaluateGoal(goal(), [obs(60, "2026-10-01")], today).freshness).toBe(
      "stale",
    );
  });
  it("uses the most recent observation and keeps history for trends", () => {
    const all = [
      obs(50, "2026-11-01"),
      obs(70, "2026-11-15"),
      obs(60, "2026-11-10"),
    ];
    expect(evaluateGoal(goal(), all, today).latest?.value).toBe(70);
    expect(
      chartable(all, "audience_growth", "follower_count").map((o) => o.value),
    ).toEqual([50, 60, 70]);
  });
  it("does not mix observations across different goals", () => {
    const g = goal({ category: "consistency", metric: "posts_per_week" });
    expect(evaluateGoal(g, [obs(99, "2026-11-20")], today).status).toBe(
      "no_observation",
    );
  });
  it("insights state recorded change without claiming a cause, and need two observations for a trend", () => {
    const v = evaluateGoals(
      [goal()],
      [obs(50, "2026-11-01"), obs(80, "2026-11-20")],
      today,
    );
    const [line] = insights(v, [obs(50, "2026-11-01"), obs(80, "2026-11-20")]);
    expect(line).toMatch(/50 on 2026-11-01 to 80 on 2026-11-20 \(\+30\)/);
    expect(line).toMatch(/does not show what caused/);
    expect(
      insights(evaluateGoals([goal()], [obs(50, "2026-11-01")], today), [
        obs(50, "2026-11-01"),
      ])[0],
    ).toMatch(/one observation/);
    expect(insights(evaluateGoals([goal()], [], today), [])).toEqual([]);
  });
});

describe("M04 weekly review, commercial, assistant, search, events, schemas", () => {
  const week = (o: Partial<WeekSummary> = {}): WeekSummary => ({
    week_start: "2026-11-16",
    week_end: "2026-11-22",
    actions: { assigned: 0, completed: 0, skipped: 0, deferred: 0 },
    observations: 0,
    ideas: 0,
    profile_updates: 0,
    goals_observed: [],
    evidence_sufficient: false,
    ...o,
  });
  it("states insufficient evidence plainly and invents nothing", () => {
    const d = describeWeek(week());
    expect(d.sufficient).toBe(false);
    expect(d.lines).toEqual([]);
    expect(d.focus).toMatch(/not enough recorded activity/);
  });
  it("describes only recorded counts, with no percentages or causal claims", () => {
    const d = describeWeek(
      week({
        actions: { assigned: 4, completed: 3, skipped: 1, deferred: 0 },
        observations: 2,
        ideas: 1,
        evidence_sufficient: true,
        goals_observed: [
          {
            category: "audience_growth",
            metric: "follower_count",
            first: 40,
            last: 55,
            count: 2,
          },
        ],
      }),
    );
    expect(d.lines.join(" ")).toMatch(/3 completed, 1 skipped/);
    expect(d.lines.join(" ")).toMatch(/follower count: recorded 40 then 55/);
    expect(d.lines.join(" ")).not.toMatch(/%|because|caused|due to/);
  });
  it("the commercial summary is unavailable (not zero) and carries no amounts", async () => {
    const c = await unavailableCommercial.summary("ws");
    expect(c.status).toBe("unavailable");
    expect(JSON.stringify(c)).not.toMatch(/minor|balance|wallet|earned/i);
    expect(c).not.toHaveProperty("agreed_minor");
    expect((c as { text: string }).text).toMatch(/does not hold or move money/);
  });
  it("the assistant is unavailable without a provider and its manual tools are real routes", () => {
    const a = assistantAvailability();
    expect(a.available).toBe(false);
    for (const t of assistantManualTools)
      expect(routeExists(t.href), t.href).toBe(true);
  });
  it("search normalizes queries and searches only public catalogues and the caller's own labels", () => {
    expect(normalizeQuery("  hello   world ")).toBe("hello world");
    expect(normalizeQuery("a")).toBeNull();
    expect(normalizeQuery("x".repeat(61))).toBeNull();
    expect(normalizeQuery(42)).toBeNull();
    const g = searchCatalogues("media kit");
    expect(g.flatMap((x) => x.hits).length).toBeGreaterThan(0);
    for (const h of g.flatMap((x) => x.hits))
      expect(isInternalPath(h.href), h.href).toBe(true);
    const own = searchOwnProfile("audience", state({ goals: [goal()] }));
    expect(own.hits).toHaveLength(1);
    expect(searchOwnProfile("audience", state()).hits).toHaveLength(0);
    expect(unsearchedModules.map((m) => m.module)).toEqual(["M10", "M12"]);
  });
  it("notifications show only whitelisted real events", () => {
    expect(describeEvent("creator_onboarding_activated")).toMatch(/completed/);
    expect(describeEvent("creator_section_saved:goals")).toBe(
      "Profile updated: Goals",
    );
    expect(describeEvent("sentinel")).toBeNull();
    expect(describeEvent("creator_section_saved:<script>")).toBeNull();
  });
  it("preferences accept only known widgets and time zones; defaults are valid", () => {
    expect(prefsSchema.safeParse(defaultPrefs).success).toBe(true);
    expect(
      prefsSchema.safeParse({ ...defaultPrefs, hidden: ["security_notice"] })
        .success,
    ).toBe(false);
    expect(
      prefsSchema.safeParse({ ...defaultPrefs, timezone: "Mars/Base" }).success,
    ).toBe(false);
  });
  it("validates ideas and observations, keeping markup as plain text", () => {
    expect(ideaSchema.safeParse({ title: "  " }).success).toBe(false);
    const r = ideaSchema.safeParse({
      title: "<img src=x onerror=alert(1)>",
      note: "",
    });
    expect(r.success && r.data.title).toBe("<img src=x onerror=alert(1)>");
    expect(r.success && r.data.note).toBeNull();
    expect(
      observationSchema.safeParse({
        goal: "audience_growth:follower_count",
        value: "0",
        observed_on: "2026-11-20",
      }).success,
    ).toBe(true);
    expect(
      observationSchema.safeParse({
        goal: "audience_growth:follower_count",
        value: "-1",
        observed_on: "2026-11-20",
      }).success,
    ).toBe(false);
    expect(
      observationSchema.safeParse({
        goal: "bad",
        value: "1",
        observed_on: "2026-11-20",
      }).success,
    ).toBe(false);
  });
});
