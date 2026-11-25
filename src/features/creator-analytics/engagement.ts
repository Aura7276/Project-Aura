import type { ContentItem, ContentObs } from "./types";
import { metricOf } from "@/features/creator-social/metrics";
// Explicit engagement calculations. A denominator is never silently swapped for another. Mirrors aura_analytics.derived_def (drift is test-checked).
export const interactionMetrics = ["likes", "comments", "shares", "saves"] as const;
export const derivedDefs = {
  engagement_by_reach: { label: "Engagement by reach", denominator: "c_reach", formula: "(likes + comments + shares + saves) ÷ content reach" },
  engagement_by_views: { label: "Engagement by views", denominator: "views", formula: "(likes + comments + shares + saves) ÷ views" },
} as const;
export type EngagementKind = keyof typeof derivedDefs;
export type Engagement =
  | { status: "unavailable"; reason: string; need: string }
  | { status: "ok"; kind: EngagementKind; percent: number; formula: string; included: string[]; denominator: string; denominatorValue: number; basis: string; observedOn: string; sources: string[]; limitations: string[] };
export const round2 = (x: number) => Math.round(x * 100) / 100;
const basisKey = (o: ContentObs) => `${o.window_kind}|${o.period_start ?? ""}|${o.period_end ?? ""}|${o.observed_on}`;
/** All inputs must share the same measurement window AND observation date. Overlapping interaction types cannot be mixed with another basis. */
export function contentEngagement(item: ContentItem, kind: EngagementKind): Engagement {
  const def = derivedDefs[kind];
  const supported = interactionMetrics.filter((m) => metricOf(m)?.platforms.includes(item.platform));
  if (!metricOf(def.denominator)?.platforms.includes(item.platform)) return { status: "unavailable", reason: `${metricOf(def.denominator)?.label ?? def.denominator} is not offered by ${item.platform}.`, need: "Use the other engagement measure if this platform provides it." };
  const denoms = item.observations.filter((o) => o.metric === def.denominator);
  if (!denoms.length) return { status: "unavailable", reason: `No ${metricOf(def.denominator)?.label.toLowerCase()} recorded for this content.`, need: `Record ${metricOf(def.denominator)?.label.toLowerCase()} for this content.` };
  // pick the most recent basis for which the denominator AND every platform-supported interaction exist
  const bases = [...new Set(denoms.map(basisKey))].sort().reverse();
  let missingFor = "";
  for (const b of bases) {
    const d = denoms.find((o) => basisKey(o) === b)!;
    const have = supported.map((m) => item.observations.find((o) => o.metric === m && basisKey(o) === b));
    if (have.some((h) => !h)) { missingFor = supported.filter((_, i) => !have[i]).join(", "); continue; }
    if (d.value <= 0) return { status: "unavailable", reason: "The denominator is zero, so a rate cannot be calculated.", need: "A rate needs a denominator above zero." };
    const used = have as ContentObs[];
    const num = used.reduce((n, o) => n + o.value, 0);
    return {
      status: "ok", kind, percent: round2((num / d.value) * 100), formula: def.formula, included: supported.slice(), denominator: def.denominator, denominatorValue: d.value,
      basis: d.window_kind === "lifetime" ? `lifetime totals as of ${d.observed_on}` : `window ${d.period_start} to ${d.period_end}, recorded ${d.observed_on}`,
      observedOn: d.observed_on, sources: [...new Set([d, ...used].map((o) => o.source))],
      limitations: ["Each platform defines these interactions a little differently.", "Percent of the stated denominator, rounded to two decimals.", ...(supported.length < interactionMetrics.length ? [`${item.platform} does not offer ${interactionMetrics.filter((m) => !supported.includes(m)).join(", ")}, so they are not included.`] : [])],
    };
  }
  return { status: "unavailable", reason: `Interactions are missing for the same date and window as the denominator${missingFor ? ` (${missingFor})` : ""}. A partial numerator would understate engagement.`, need: "Record each interaction type for the same window and date." };
}
export type AccountRate =
  | { status: "unavailable"; reason: string }
  | { status: "ok"; percent: number; formula: string; numerator: number; denominator: number; denominatorLabel: string; limitations: string[] };
export function accountEngagement(interactions: number | null, denominator: number | null, kind: "reach" | "followers"): AccountRate {
  const label = kind === "reach" ? "account reach over the same period" : "followers at the latest snapshot inside the period";
  if (interactions === null || denominator === null) return { status: "unavailable", reason: `Needs interactions and ${label}.` };
  if (denominator <= 0) return { status: "unavailable", reason: "The denominator is zero, so a rate cannot be calculated." };
  return { status: "ok", percent: round2((interactions / denominator) * 100), numerator: interactions, denominator, denominatorLabel: label, formula: `account interactions ÷ ${label}`,
    limitations: ["Platforms define account interactions differently.", kind === "followers" ? "Follower count is a snapshot, not the audience that was actually reached." : "Reach counts unique accounts."] };
}
