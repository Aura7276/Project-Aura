import { basisOf, latestOf, type Basis } from "./compare";
import type { ContentItem } from "./types";
import { metricOf } from "@/features/creator-social/metrics";
import { daysBetween } from "./periods";
// Exploratory, rule-based pattern analysis. It is NOT AI. It reports sample sizes and descriptive differences and never claims cause.
export const minPerGroup = 3;
export type GroupStat = {
  value: string;
  n: number;
  median: number;
  min: number;
  max: number;
};
export type PatternResult =
  | {
      status: "insufficient";
      reason: string;
      need: string;
      classified: number;
      total: number;
    }
  | {
      status: "ok";
      dimension: string;
      metric: string;
      basis: string;
      groups: GroupStat[];
      leader: {
        value: string;
        over: string;
        diff: number;
        relative: number | null;
      } | null;
      strength: "exploratory" | "suggestive";
      classified: number;
      unclassified: number;
      limitations: string[];
    };
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export type Dimension =
  | "topic"
  | "niche"
  | "pillar"
  | "format"
  | "hook"
  | "duration"
  | "style"
  | "time_category"
  | "sponsorship"
  | "custom";
export function groupOf(
  item: ContentItem,
  dim: Dimension,
  derived?: (i: ContentItem) => string | null,
): string | null {
  if (dim === "format") return item.format;
  if (derived) return derived(item);
  const t = item.tags.find((x) => x.kind === dim && x.status === "confirmed");
  return t?.value.toLowerCase() ?? null;
}
const basisKey = (b: Basis) => (b.kind === "window" ? `w${b.days}` : "life");
/** Chooses ONE measurement basis shared by every item used: the fixed-length window most items have, else lifetime totals of a similar content age. */
export function pickBasis(
  items: ContentItem[],
  metric: string,
): {
  key: string;
  label: string;
  pick: (i: ContentItem) => number | null;
} | null {
  const counts = new Map<string, number>();
  for (const i of items)
    for (const o of i.observations.filter(
      (o) => o.metric === metric && o.window_kind === "window",
    ))
      counts.set(
        `w${daysBetween(o.period_start!, o.period_end!) + 1}`,
        (counts.get(`w${daysBetween(o.period_start!, o.period_end!) + 1}`) ??
          0) + 1,
      );
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] >= minPerGroup * 2) {
    const days = Number(best[0].slice(1));
    return {
      key: best[0],
      label: `${days}-day window totals`,
      pick: (i) =>
        i.observations
          .filter(
            (o) =>
              o.metric === metric &&
              o.window_kind === "window" &&
              daysBetween(o.period_start!, o.period_end!) + 1 === days,
          )
          .at(-1)?.value ?? null,
    };
  }
  const ages = items
    .map((i) => {
      const o = latestOf(i, metric, "lifetime");
      const b = o ? basisOf(i, o) : null;
      return b && b.kind === "lifetime" ? b.ageDays : null;
    })
    .filter((x): x is number => x !== null);
  if (ages.length >= minPerGroup * 2) {
    const mid = median(ages);
    const lo = Math.max(0, mid - Math.max(3, mid * 0.25)),
      hi = mid + Math.max(3, mid * 0.25);
    return {
      key: "life",
      label: `lifetime totals recorded at a similar content age (${Math.round(lo)} to ${Math.round(hi)} days)`,
      pick: (i) => {
        const o = latestOf(i, metric, "lifetime");
        const b = o ? basisOf(i, o) : null;
        return o &&
          b &&
          b.kind === "lifetime" &&
          b.ageDays !== null &&
          b.ageDays >= lo &&
          b.ageDays <= hi
          ? o.value
          : null;
      },
    };
  }
  return null;
}
export function analyzePattern(
  items: ContentItem[],
  dim: Dimension,
  metric: string,
  derived?: (i: ContentItem) => string | null,
): PatternResult {
  const def = metricOf(metric);
  const platforms = new Set(items.map((i) => i.platform));
  if (!def || def.scope !== "content")
    return {
      status: "insufficient",
      reason: "Choose a content metric.",
      need: "",
      classified: 0,
      total: items.length,
    };
  const classified = items.filter((i) => groupOf(i, dim, derived) !== null);
  const base = { classified: classified.length, total: items.length };
  if (platforms.size > 1)
    return {
      status: "insufficient",
      ...base,
      reason:
        "Content from different platforms is not analysed together because the same metric is defined differently on each.",
      need: "Filter to one platform.",
    };
  const basis = pickBasis(classified, metric);
  if (!basis)
    return {
      status: "insufficient",
      ...base,
      reason: `Not enough ${def.label.toLowerCase()} recorded on a shared basis. At least ${minPerGroup * 2} classified items need the same window (or a similar content age).`,
      need: `Record ${def.label.toLowerCase()} for the same window (for example 7 days) on more content, and classify it.`,
    };
  const by = new Map<string, number[]>();
  for (const i of classified) {
    const v = basis.pick(i);
    if (v !== null)
      by.set(groupOf(i, dim, derived)!, [
        ...(by.get(groupOf(i, dim, derived)!) ?? []),
        v,
      ]);
  }
  const groups: GroupStat[] = [...by.entries()]
    .filter(([, v]) => v.length >= minPerGroup)
    .map(([value, v]) => ({
      value,
      n: v.length,
      median: median(v),
      min: Math.min(...v),
      max: Math.max(...v),
    }))
    .sort((a, b) => b.median - a.median);
  if (groups.length < 2)
    return {
      status: "insufficient",
      ...base,
      reason: `Fewer than two groups have ${minPerGroup} or more items on the same basis, so there is nothing to compare yet.`,
      need: `Gather at least ${minPerGroup} items in each of two groups.`,
    };
  const [a, b] = groups;
  const diff = a.median - b.median;
  return {
    status: "ok",
    dimension: dim,
    metric,
    basis: basis.label,
    groups,
    classified: base.classified,
    unclassified: items.length - classified.length,
    leader: {
      value: a.value,
      over: b.value,
      diff,
      relative: b.median > 0 ? Math.round((diff / b.median) * 1000) / 10 : null,
    },
    strength: groups.every((g) => g.n >= 8) ? "suggestive" : "exploratory",
    limitations: [
      "Descriptive only: a difference between groups does not show that the attribute caused it.",
      "Topics, timing and luck vary together; other differences between posts are not controlled.",
      `Medians of ${groups.map((g) => g.n).join(" and ")} items. Small samples swing easily.`,
      "Items missing a tag or a comparable observation are left out, not counted as zero.",
    ],
  };
}
export const basisLabels = { basisKey };
