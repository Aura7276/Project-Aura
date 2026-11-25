import { describe, expect, it } from "vitest";
import {
  addDays,
  localDay,
  resolveRange,
  span,
} from "@/features/creator-analytics/periods";
import {
  comparePeriods,
  intervalTotal,
  netGrowth,
  toPoints,
} from "@/features/creator-analytics/growth";
import {
  accountEngagement,
  contentEngagement,
} from "@/features/creator-analytics/engagement";
import {
  consolidateLatest,
  weightedRate,
} from "@/features/creator-analytics/consolidate";
import { compareContent } from "@/features/creator-analytics/compare";
import { analyzePattern } from "@/features/creator-analytics/patterns";
import {
  categoryOf,
  timingAnalysis,
} from "@/features/creator-analytics/timing";
import { scenarioForecast } from "@/features/creator-analytics/forecast";
import {
  canMove,
  editable,
  measure,
  outcomeHint,
  templates,
} from "@/features/creator-analytics/experiments";
import {
  generateInsights,
  hash,
  allRules,
} from "@/features/creator-analytics/insights";
import { csvCell, toCsv, toPdf } from "@/features/creator-analytics/exports";
import { canUse, features } from "@/features/creator-analytics/features";
import * as contracts from "@/features/creator-analytics/contracts";
import { aggregations } from "@/features/creator-analytics/semantics";
import { metrics } from "@/features/creator-social/metrics";
import type {
  AccountObs,
  AccountRef,
  ContentItem,
  ContentObs,
} from "@/features/creator-analytics/types";

const today = "2026-11-25";
let n = 0;
const ao = (
  account: string,
  metric: string,
  value: number,
  observed_on: string,
  ps: string | null = null,
  pe: string | null = null,
): AccountObs => ({
  id: `o${++n}`,
  account_id: account,
  metric,
  value,
  observed_on,
  period_start: ps,
  period_end: pe,
  source: "manual",
  has_evidence: false,
  corrected: false,
  entered_at: `2026-11-01T00:00:${String(n % 60).padStart(2, "0")}Z`,
});
const acct = (id: string, platform = "instagram"): AccountRef => ({
  id,
  platform,
  handle: id,
  display_name: null,
  lifecycle: "active",
  connection: "manual",
  history_stale_since: null,
  is_primary: id === "a1",
});
const co = (
  metric: string,
  value: number,
  observed_on: string,
  w?: [string, string],
): ContentObs => ({
  id: `c${++n}`,
  metric,
  value,
  window_kind: w ? "window" : "lifetime",
  period_start: w?.[0] ?? null,
  period_end: w?.[1] ?? null,
  observed_on,
  source: "manual",
  corrected: false,
  has_evidence: false,
});
const item = (id: string, over: Partial<ContentItem> = {}): ContentItem => ({
  id,
  account_id: "a1",
  platform: "instagram",
  handle: "a1",
  external_id: id,
  url: null,
  title: id,
  format: "short_video",
  published_on: "2026-10-01",
  published_at: null,
  tz: null,
  tags: [],
  observations: [],
  ...over,
});
const tag = (kind: string, value: string) => ({
  id: `t${++n}`,
  kind,
  value,
  source: "manual",
  status: "confirmed",
  uncertainty: null,
});
const view7 = (v: number) =>
  co("views", v, "2026-10-09", ["2026-10-02", "2026-10-08"]);

describe("M06 periods", () => {
  it("resolves inclusive ranges and a same-length previous period", () => {
    const r = resolveRange("30d", today);
    expect(r.ok && r.current).toEqual({
      start: "2026-10-27",
      end: "2026-11-25",
      days: 30,
    });
    expect(r.ok && r.previous).toEqual({
      start: "2026-09-27",
      end: "2026-10-26",
      days: 30,
    });
    expect(r.ok && r.includesToday).toBe(true);
    expect(r.ok && r.notes.join(" ")).toMatch(
      /includes today, which is not finished/,
    );
  });
  it("validates custom ranges", () => {
    expect(
      resolveRange("custom", today, { start: "2026-11-10", end: "2026-11-01" })
        .ok,
    ).toBe(false);
    expect(
      resolveRange("custom", today, { start: "2026-11-10", end: "2026-12-30" })
        .ok,
    ).toBe(false);
    expect(
      resolveRange("custom", today, { start: "2026-02-30", end: "2026-03-01" })
        .ok,
    ).toBe(false);
    expect(
      resolveRange("custom", today, { start: "2023-01-01", end: "2026-11-01" })
        .ok,
    ).toBe(false);
    const ok = resolveRange("custom", today, {
      start: "2026-11-01",
      end: "2026-11-10",
    });
    expect(ok.ok && ok.includesToday).toBe(false);
  });
  it("assigns a late evening instant to the Creator's local day", () => {
    expect(localDay("2026-11-24T20:30:00Z", "Asia/Kolkata")).toBe("2026-11-25");
    expect(localDay("2026-11-24T20:30:00Z", "America/Los_Angeles")).toBe(
      "2026-11-24",
    );
    expect(localDay("2026-11-24T20:30:00Z", "Not/AZone")).toBeNull();
  });
});

describe("M06 net growth", () => {
  const P = span("2026-10-27", "2026-11-25");
  it("uses the latest observation on or before the start as the baseline and shows real dates", () => {
    const g = netGrowth(
      toPoints(
        [
          ao("a1", "followers", 1000, "2026-10-25"),
          ao("a1", "followers", 1180, "2026-11-24"),
        ],
        "a1",
        "followers",
      ),
      P,
    );
    expect(g.status).toBe("ok");
    if (g.status === "unavailable") return;
    expect(g.baseline.date).toBe("2026-10-25");
    expect(g.latest.date).toBe("2026-11-24");
    expect(g.net).toBe(180);
    expect(g.pct).toBe(18);
    expect(g.notes.join(" ")).toMatch(/before the period began/);
  });
  it("never interpolates: no baseline within tolerance means unavailable with what is needed", () => {
    const g = netGrowth(
      toPoints(
        [
          ao("a1", "followers", 1000, "2026-08-01"),
          ao("a1", "followers", 1100, "2026-11-20"),
        ],
        "a1",
        "followers",
      ),
      P,
    );
    expect(g.status).toBe("unavailable");
    expect(g.status === "unavailable" && g.need).toMatch(/Record the number/);
  });
  it("does not calculate a percentage from a zero baseline", () => {
    const g = netGrowth(
      toPoints(
        [
          ao("a1", "followers", 0, "2026-10-27"),
          ao("a1", "followers", 40, "2026-11-25"),
        ],
        "a1",
        "followers",
      ),
      P,
    );
    expect(g.status === "ok" && g.net).toBe(40);
    expect(g.status !== "unavailable" && g.pct).toBeNull();
    expect(g.status !== "unavailable" && g.pctNote).toMatch(/zero/);
  });
  it("a single observation is unavailable, never zero growth", () => {
    expect(
      netGrowth(
        toPoints([ao("a1", "followers", 100, "2026-10-27")], "a1", "followers"),
        P,
      ).status,
    ).toBe("unavailable");
    expect(netGrowth([], P).status).toBe("unavailable");
  });
  it("treats an actual zero latest value as a value", () => {
    const g = netGrowth(
      toPoints(
        [
          ao("a1", "followers", 50, "2026-10-27"),
          ao("a1", "followers", 0, "2026-11-25"),
        ],
        "a1",
        "followers",
      ),
      P,
    );
    expect(g.status !== "unavailable" && g.net).toBe(-50);
  });
  it("blocks a comparison when one period has no data or the coverage differs a lot", () => {
    const pts = toPoints(
      [
        ao("a1", "followers", 900, "2026-10-26"),
        ao("a1", "followers", 1000, "2026-11-25"),
      ],
      "a1",
      "followers",
    );
    const cur = netGrowth(pts, P),
      prev = netGrowth(pts, span("2026-09-27", "2026-10-26"));
    expect(comparePeriods(cur, prev).status).toBe("blocked");
    const pts2 = toPoints(
      [
        ao("a1", "followers", 800, "2026-09-27"),
        ao("a1", "followers", 900, "2026-10-26"),
        ao("a1", "followers", 1000, "2026-11-25"),
      ],
      "a1",
      "followers",
    );
    expect(
      comparePeriods(
        netGrowth(pts2, P),
        netGrowth(pts2, span("2026-09-27", "2026-10-26")),
      ).status,
    ).toBe("comparable");
    const partial = toPoints(
      [
        ao("a1", "followers", 800, "2026-09-27"),
        ao("a1", "followers", 900, "2026-10-26"),
        ao("a1", "followers", 910, "2026-11-01"),
      ],
      "a1",
      "followers",
    );
    expect(
      comparePeriods(
        netGrowth(partial, P),
        netGrowth(partial, span("2026-09-27", "2026-10-26")),
      ).status,
    ).toBe("blocked");
  });
  it("never sums unique reach across windows; sums non-overlapping windows for summable metrics and says what is covered", () => {
    const o = [
      ao("a1", "reach", 1000, "2026-11-05", "2026-10-30", "2026-11-05"),
      ao("a1", "reach", 1200, "2026-11-12", "2026-11-06", "2026-11-12"),
    ];
    expect(intervalTotal(o, "a1", "reach", P, { summable: false }).status).toBe(
      "unavailable",
    );
    const imp = [
      ao("a1", "impressions", 10, "2026-11-05", "2026-10-30", "2026-11-05"),
      ao("a1", "impressions", 20, "2026-11-12", "2026-11-06", "2026-11-12"),
      ao("a1", "impressions", 99, "2026-11-12", "2026-11-04", "2026-11-12"),
    ];
    const t = intervalTotal(imp, "a1", "impressions", P, { summable: true });
    expect(t.status).toBe("partial");
    expect(t.status !== "unavailable" && t.total).toBe(30);
    expect(t.status !== "unavailable" && t.notes.join(" ")).toMatch(
      /Overlapping windows were skipped/,
    );
    const exact = intervalTotal(
      [ao("a1", "reach", 5000, "2026-11-25", P.start, P.end)],
      "a1",
      "reach",
      P,
      { summable: false },
    );
    expect(exact.status === "ok" && exact.total).toBe(5000);
  });
});

describe("M06 engagement", () => {
  const base = (over: Partial<ContentItem> = {}) =>
    item("x", {
      observations: [
        co("c_reach", 2000, "2026-10-09", ["2026-10-02", "2026-10-08"]),
        co("likes", 100, "2026-10-09", ["2026-10-02", "2026-10-08"]),
        co("comments", 20, "2026-10-09", ["2026-10-02", "2026-10-08"]),
        co("shares", 10, "2026-10-09", ["2026-10-02", "2026-10-08"]),
        co("saves", 20, "2026-10-09", ["2026-10-02", "2026-10-08"]),
      ],
      ...over,
    });
  it("calculates engagement by reach with an explicit formula, window and rounding", () => {
    const e = contentEngagement(base(), "engagement_by_reach");
    expect(e.status).toBe("ok");
    if (e.status === "ok") {
      expect(e.percent).toBe(7.5);
      expect(e.denominator).toBe("c_reach");
      expect(e.formula).toMatch(/content reach/);
      expect(e.basis).toMatch(/window 2026-10-02 to 2026-10-08/);
    }
  });
  it("does not swap denominators: engagement by views needs views", () => {
    const e = contentEngagement(base(), "engagement_by_views");
    expect(e.status).toBe("unavailable");
    expect(e.status === "unavailable" && e.reason).toMatch(/No views recorded/);
  });
  it("refuses a partial numerator and a zero denominator", () => {
    const partial = base();
    partial.observations = partial.observations.filter(
      (o) => o.metric !== "shares",
    );
    const e = contentEngagement(partial, "engagement_by_reach");
    expect(e.status).toBe("unavailable");
    expect(e.status === "unavailable" && e.reason).toMatch(/shares/);
    const zero = base();
    zero.observations = zero.observations.map((o) =>
      o.metric === "c_reach" ? { ...o, value: 0 } : o,
    );
    expect(contentEngagement(zero, "engagement_by_reach").status).toBe(
      "unavailable",
    );
  });
  it("does not mix different measurement windows", () => {
    const mixed = base();
    mixed.observations = mixed.observations.map((o) =>
      o.metric === "likes"
        ? {
            ...o,
            window_kind: "lifetime" as const,
            period_start: null,
            period_end: null,
          }
        : o,
    );
    expect(contentEngagement(mixed, "engagement_by_reach").status).toBe(
      "unavailable",
    );
  });
  it("account rates need both inputs and a positive denominator", () => {
    expect(accountEngagement(100, 0, "reach").status).toBe("unavailable");
    expect(accountEngagement(null, 10, "followers").status).toBe("unavailable");
    const r = accountEngagement(30, 1200, "followers");
    expect(r.status === "ok" && r.percent).toBe(2.5);
  });
});

describe("M06 consolidation", () => {
  const accounts = [acct("a1"), acct("a2", "youtube")];
  it("labels a follower total as possibly overlapping and never calls it unique audience", () => {
    const c = consolidateLatest(
      [
        ao("a1", "followers", 1000, "2026-11-20"),
        ao("a2", "followers", 500, "2026-11-22"),
      ],
      accounts,
      "followers",
      today,
    );
    expect(c.status).toBe("aggregate");
    if (c.status === "aggregate") {
      expect(c.total).toBe(1500);
      expect(c.label).toMatch(/possible overlap, not unique people/);
      expect(c.caveat).toMatch(/no de-duplication evidence/);
      expect(c.contributions).toHaveLength(2);
    }
  });
  it("never aggregates unique reach and keeps per-account contributions", () => {
    const c = consolidateLatest(
      [ao("a1", "reach", 100, "2026-11-20", "2026-11-14", "2026-11-20")],
      accounts,
      "reach",
      today,
    );
    expect(c.status).toBe("per_account_only");
  });
  it("unknown is not zero in a total", () => {
    const c = consolidateLatest(
      [ao("a1", "followers", 1000, "2026-11-20")],
      accounts,
      "followers",
      today,
    );
    expect(c.status === "aggregate" && c.total).toBe(1000);
    expect(
      c.status === "aggregate" &&
        c.contributions.find((x) => x.account.id === "a2")?.state,
    ).toBe("unknown");
    expect(consolidateLatest([], accounts, "followers", today).status).toBe(
      "per_account_only",
    );
  });
  it("uses a denominator-weighted rate, not an average of percentages", () => {
    const w = weightedRate([
      { account: "a", numerator: 10, denominator: 100 },
      { account: "b", numerator: 400, denominator: 1000 },
      { account: "c", numerator: null, denominator: 50 },
    ]);
    expect(w.status === "ok" && w.percent).toBe(37.27);
    expect(w.status === "ok" && w.accounts).toBe(2); // the plain average of 10% and 40% would be 25%
    expect(
      weightedRate([{ account: "a", numerator: 1, denominator: 0 }]).status,
    ).toBe("unavailable");
  });
});

describe("M06 content comparison", () => {
  it("blocks lifetime totals recorded at very different content ages, with a reason and an alternative", () => {
    const a = item("old", {
      published_on: "2026-06-01",
      observations: [co("views", 90000, "2026-11-20")],
    });
    const b = item("new", {
      published_on: "2026-11-10",
      observations: [co("views", 4000, "2026-11-20")],
    });
    const c = compareContent([a, b], "views");
    expect(c.comparable).toBe(false);
    if (!c.comparable) {
      expect(c.reasons.join(" ")).toMatch(/longer to collect/);
      expect(c.alternative).toMatch(/same fixed window/);
    }
  });
  it("blocks different platforms and mixed lifetime versus window totals", () => {
    const a = item("a", { platform: "youtube", observations: [view7(10)] }),
      b = item("b", { observations: [view7(12)] });
    expect(compareContent([a, b], "views").comparable).toBe(false);
    const c = item("c", { observations: [view7(10)] }),
      d = item("d", { observations: [co("views", 500, "2026-10-20")] });
    const r = compareContent([c, d], "views");
    expect(r.comparable).toBe(false);
    expect(!r.comparable && r.reasons.join(" ")).toMatch(
      /lifetime total and a 7-day total are not comparable|No comparable/,
    );
  });
  it("compares equal windows and describes the order without claiming cause", () => {
    const r = compareContent(
      [
        item("a", { observations: [view7(100)] }),
        item("b", { observations: [view7(250)] }),
      ],
      "views",
    );
    expect(r.comparable).toBe(true);
    if (r.comparable) {
      expect(r.rows[0].item.id).toBe("b");
      expect(r.basisLabel).toBe("7-day window totals");
      expect(r.reading).toMatch(/does not show why/);
    }
  });
  it("lifetime totals at a similar age are comparable", () => {
    const r = compareContent(
      [
        item("a", {
          published_on: "2026-10-01",
          observations: [co("views", 100, "2026-10-15")],
        }),
        item("b", {
          published_on: "2026-10-02",
          observations: [co("views", 90, "2026-10-16")],
        }),
      ],
      "views",
    );
    expect(r.comparable).toBe(true);
  });
  it("needs at least two items and a content metric", () => {
    expect(compareContent([item("a")], "views").comparable).toBe(false);
    expect(compareContent([item("a"), item("b")], "followers").comparable).toBe(
      false,
    );
  });
});

describe("M06 patterns and timing", () => {
  const items = (vals: Record<string, number[]>) =>
    Object.entries(vals).flatMap(([hook, vs]) =>
      vs.map((v, i) =>
        item(`${hook}${i}`, {
          tags: [tag("hook", hook)],
          observations: [view7(v)],
        }),
      ),
    );
  it("reports sample sizes, medians and exploratory limits", () => {
    const p = analyzePattern(
      items({ question: [300, 280, 320, 310], statement: [200, 210, 190] }),
      "hook",
      "views",
    );
    expect(p.status).toBe("ok");
    if (p.status === "ok") {
      expect(p.leader?.value).toBe("question");
      expect(p.groups.map((g) => g.n).sort()).toEqual([3, 4]);
      expect(p.strength).toBe("exploratory");
      expect(p.limitations.join(" ")).toMatch(
        /does not show that the attribute caused/,
      );
    }
  });
  it("is insufficient with small groups and says what is needed", () => {
    const p = analyzePattern(
      items({ question: [300, 280], statement: [200] }),
      "hook",
      "views",
    );
    expect(p.status).toBe("insufficient");
    expect(p.status === "insufficient" && p.need).toBeTruthy();
  });
  it("does not analyse across platforms and leaves untagged content out rather than counting it as zero", () => {
    expect(
      analyzePattern(
        [
          ...items({ q: [1, 2, 3], s: [4, 5, 6] }),
          item("yt", { platform: "youtube" }),
        ],
        "hook",
        "views",
      ).status,
    ).toBe("insufficient");
    const mixed = [
      ...items({ question: [300, 280, 320], statement: [200, 210, 190] }),
      item("untagged", { observations: [view7(1)] }),
    ];
    const p = analyzePattern(mixed, "hook", "views");
    expect(p.status === "ok" && p.unclassified).toBe(1);
  });
  it("organic, sponsored and unclassified stay separate", () => {
    const list = [
      ...[10, 11, 12].map((v, i) =>
        item(`o${i}`, {
          tags: [tag("sponsorship", "organic")],
          observations: [view7(v)],
        }),
      ),
      ...[20, 21, 22].map((v, i) =>
        item(`s${i}`, {
          tags: [tag("sponsorship", "sponsored")],
          observations: [view7(v)],
        }),
      ),
      item("u", { observations: [view7(5)] }),
    ];
    const p = analyzePattern(list, "sponsorship", "views");
    expect(p.status === "ok" && p.groups.map((g) => g.value).sort()).toEqual([
      "organic",
      "sponsored",
    ]);
    expect(p.status === "ok" && p.unclassified).toBe(1);
  });
  it("assigns time categories in the Creator's zone", () => {
    expect(categoryOf("2026-11-25T14:30:00Z", "Asia/Kolkata")?.category).toBe(
      "evening",
    );
    expect(categoryOf("2026-11-25T14:30:00Z", "UTC")?.category).toBe(
      "afternoon",
    );
  });
  it("publishing-time analysis needs timestamps and never claims audience activity", () => {
    const none = timingAnalysis(
      [item("a", { observations: [view7(5)] })],
      "views",
    );
    expect(none.confidence).toBe("none");
    expect(none.suggestion).toBeNull();
    expect(none.experiment).toMatch(/two different time windows/);
    const mk = (hour: number, v: number, i: number) =>
      item(`t${hour}${i}`, {
        tz: "UTC",
        published_at: `2026-10-${String(10 + i).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00Z`,
        observations: [view7(v)],
      });
    const list = [0, 1, 2, 3]
      .map((i) => mk(8, 100 + i, i))
      .concat([0, 1, 2, 3].map((i) => mk(19, 200 + i, i + 4)));
    const t = timingAnalysis(list, "views");
    expect(t.suggestion?.window).toBe("evening");
    expect(["low", "moderate"]).toContain(t.confidence);
    expect(t.limitations.join(" ")).toMatch(
      /not on when your audience was online/,
    );
  });
});

describe("M06 forecast", () => {
  const pts = (n: number, stepDays: number, start = 1000, per = 5) =>
    Array.from({ length: n }, (_, i) => ({
      id: `p${i}`,
      value: start + i * stepDays * per + (i % 2),
      date: addDays("2026-08-01", i * stepDays),
      source: "manual" as const,
      corrected: false,
    }));
  it("refuses with specific reasons when history is thin or has gaps", () => {
    const f = scenarioForecast(pts(4, 7), 30);
    expect(f.status).toBe("insufficient");
    expect(f.status === "insufficient" && f.reasons.join(" ")).toMatch(
      /at least 8/,
    );
    expect(
      scenarioForecast(
        [
          ...pts(5, 7),
          ...pts(5, 7).map((p, i) => ({
            ...p,
            id: "g" + i,
            date: addDays("2026-10-20", i * 7),
          })),
        ],
        30,
      ).status,
    ).toBe("insufficient");
  });
  it("returns ordered scenario ranges, labelled as not a prediction", () => {
    const f = scenarioForecast(pts(10, 7), 30);
    expect(f.status).toBe("ok");
    if (f.status === "ok") {
      const [l, m, u] = f.scenarios;
      expect(l.value).toBeLessThanOrEqual(m.value);
      expect(m.value).toBeLessThanOrEqual(u.value);
      expect(f.limitations.join(" ")).toMatch(/not a prediction/);
    }
  });
});

describe("M06 experiments", () => {
  it("only allows the documented lifecycle moves", () => {
    expect(canMove("draft", "active")).toBe(true);
    expect(canMove("active", "completed")).toBe(true);
    expect(canMove("completed", "active")).toBe(false);
    expect(canMove("cancelled", "planned")).toBe(false);
    expect(editable("planned")).toBe(true);
    expect(editable("active")).toBe(false);
  });
  it("measures descriptively, never claims significance, and reports a zero baseline honestly", () => {
    const b = [
      {
        ref: "1",
        value: 100,
        observed_on: "2026-10-01",
        window_days: 7,
        source: "manual",
      },
    ];
    const l = [120, 130, 125].map((v, i) => ({
      ref: `l${i}`,
      value: v,
      observed_on: "2026-10-1" + i,
      window_days: 7,
      source: "manual",
    }));
    const m = measure(b, l, 28, { confounders: "Holiday" });
    expect(m.status === "ok" && m.absolute).toBe(25);
    expect(m.status === "ok" && m.relative).toBe(25);
    expect(m.status === "ok" && m.direction).toBe("higher");
    expect(m.status === "ok" && m.limitations.join(" ")).toMatch(
      /No statistical test/,
    );
    expect(m.status === "ok" && m.limitations.join(" ")).toMatch(
      /not a controlled experiment/,
    );
    expect(m.status === "ok" && m.limitations.join(" ")).toMatch(/Holiday/);
    expect(outcomeHint(m)).toBe("observed_improvement");
    const z = measure([{ ...b[0], value: 0 }], l, 28);
    expect(z.status === "ok" && z.relative).toBeNull();
    expect(measure([], l, 28).status).toBe("no_baseline");
    expect(measure(b, [], 28).status).toBe("no_observations");
    expect(outcomeHint(measure(b, l.slice(0, 1), 28))).toBe(
      "insufficient_evidence",
    );
  });
  it("templates are starting points with confounders and a measurement method", () => {
    expect(templates.length).toBeGreaterThanOrEqual(5);
    for (const t of templates) {
      expect(t.confounders).toBeTruthy();
      expect(t.measurement_method).toBeTruthy();
      expect(t.hypothesis).toMatch(/may/);
      expect(metrics.some((m) => m.code === t.metric)).toBe(true);
    }
  });
});

describe("M06 insights", () => {
  const inputs = (
    over: Partial<Parameters<typeof generateInsights>[0]> = {},
  ) => {
    const r = resolveRange("30d", today);
    if (!r.ok) throw new Error();
    return {
      today,
      period: r.current,
      previous: r.previous,
      accounts: [acct("a1")],
      observations: [] as AccountObs[],
      content: [] as ContentItem[],
      hasActiveExperiment: false,
      ...over,
    };
  };
  it("asks for a first number instead of showing zero", () => {
    const i = generateInsights(inputs());
    expect(i[0].rule_key).toBe("rule.no_observations");
    expect(i[0].explanation).toMatch(/not a count of zero/);
    expect(i[0].link).toMatch(/^\/creator\//);
  });
  it("flags stale data with its evidence and age", () => {
    const i = generateInsights(
      inputs({ observations: [ao("a1", "followers", 100, "2026-09-01")] }),
    );
    expect(
      i.some(
        (x) =>
          x.rule_key === "rule.stale_account" &&
          (x.evidence as { daysOld: number }).daysOld > 14,
      ),
    ).toBe(true);
  });
  it("is deterministic and the data hash changes when evidence changes", () => {
    const a = generateInsights(
        inputs({ observations: [ao("a1", "followers", 100, "2026-09-01")] }),
      ),
      b = generateInsights(
        inputs({ observations: [ao("a1", "followers", 100, "2026-09-01")] }),
      );
    expect(a.map((x) => [x.fingerprint, x.data_hash])).toEqual(
      b.map((x) => [x.fingerprint, x.data_hash]),
    );
    expect(hash({ a: 1 })).not.toBe(hash({ a: 2 }));
  });
  it("never produces a score, a fraud accusation, an AI claim or external links", () => {
    const content = [
      ...[1, 2, 3].map((i) =>
        item(`q${i}`, {
          format: "short_video",
          observations: [view7(300 + i)],
        }),
      ),
      ...[1, 2, 3].map((i) =>
        item(`i${i}`, { format: "image", observations: [view7(100 + i)] }),
      ),
    ];
    const list = generateInsights(
      inputs({
        content,
        observations: [
          ao("a1", "followers", 100, "2026-10-01"),
          ao("a1", "followers", 0, "2026-11-20"),
        ],
      }),
    );
    expect(list.length).toBeGreaterThan(1);
    const text = JSON.stringify(list);
    expect(text).not.toMatch(
      /\bscore\b|rating|fraud|fake|bot account|AI-generated|artificial intelligence|guarantee/i,
    );
    for (const x of list) {
      expect(x.link).toMatch(/^\/creator\/[a-z0-9/_-]*$/);
      expect(
        allRules.some(
          (r) =>
            x.rule_key === r ||
            x.rule_key.startsWith(r.split(".").slice(0, 2).join(".")),
        ),
      ).toBe(true);
      expect(x.limitations.length).toBeGreaterThan(0);
    }
    expect(
      list
        .find((x) => x.rule_key === "rule.content_pattern.format")
        ?.limitations.join(" "),
    ).toMatch(/does not show that the attribute caused/);
  });
});

describe("M06 exports, features, contracts, semantics", () => {
  it("neutralizes spreadsheet formulas and quotes correctly", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(0)).toBe("0");
    expect(
      toCsv(
        ["a", "b"],
        [
          [1, "x"],
          [2, "@y"],
        ],
      ),
    ).toBe("a,b\r\n1,x\r\n2,'@y\r\n");
  });
  it("writes a structurally valid PDF with escaped text", () => {
    const bytes = toPdf("Report (test)", [
      "Line with (parentheses) and \\ slash",
      "Zero ≠ unknown ÷ 2",
      ...Array(80).fill("row"),
    ]);
    const s = new TextDecoder().decode(bytes);
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(s).toMatch(/\/Count 2/);
    expect(s).toContain("\\(parentheses\\)");
    const xref = Number(/startxref\n(\d+)/.exec(s)![1]);
    expect(s.slice(xref, xref + 4)).toBe("xref");
  });
  it("marks tiers but enforces none yet", () => {
    expect(features.csv.tier).toBe("core");
    expect(features.forecast.tier).toBe("advanced");
    expect(canUse("forecast")).toBe(true);
  });
  it("every future capability is unavailable and says why", () => {
    for (const c of [
      contracts.competitorTracking,
      contracts.suspiciousPatterns,
      contracts.campaignMatching,
      contracts.commercialLink,
      contracts.aiClassification,
    ]) {
      expect(c.available).toBe(false);
      expect(c.reason.length).toBeGreaterThan(20);
      expect(c.dependency).toBeTruthy();
    }
    expect(contracts.suspiciousPatterns.reason).toMatch(/does not accuse/);
    expect(contracts.classificationProvider).toBeNull();
  });
  it("semantics cover every M05 metric and unique counts are never summable", () => {
    for (const m of metrics) expect(aggregations[m.code]).toBeTruthy();
    expect(aggregations.reach).toEqual(["per_account"]);
    expect(aggregations.c_reach).toEqual(["per_content"]);
  });
});
