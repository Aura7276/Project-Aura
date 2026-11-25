import type { Check } from "./catalogue";
// Metric dictionary. Mirrors aura_social.metric_def. Platform support is PROPOSED and must be checked against each provider's
// documentation before an integration is built. Freshness thresholds are non-production defaults awaiting owner approval.
export type MetricScope = "account" | "content";
export type MetricShape = "point" | "cumulative" | "window" | "either";
export type Metric = {
  code: string;
  label: string;
  unit: "count" | "seconds";
  scope: MetricScope;
  shape: MetricShape;
  min: number;
  max: number;
  platforms: readonly string[];
  freshDays: number;
  help: string;
};
const all = [
  "instagram",
  "youtube",
  "facebook",
  "linkedin",
  "threads",
  "other",
];
export const metrics: readonly Metric[] = [
  {
    code: "followers",
    label: "Followers or subscribers",
    unit: "count",
    scope: "account",
    shape: "point",
    min: 0,
    max: 2_000_000_000,
    platforms: all,
    freshDays: 14,
    help: "Your count on a given date.",
  },
  {
    code: "following",
    label: "Following",
    unit: "count",
    scope: "account",
    shape: "point",
    min: 0,
    max: 100_000_000,
    platforms: ["instagram", "facebook", "threads"],
    freshDays: 30,
    help: "Accounts you follow, on a given date.",
  },
  {
    code: "posts_total",
    label: "Total published content",
    unit: "count",
    scope: "account",
    shape: "cumulative",
    min: 0,
    max: 100_000_000,
    platforms: all,
    freshDays: 30,
    help: "Lifetime total as of a date.",
  },
  {
    code: "reach",
    label: "Account reach",
    unit: "count",
    scope: "account",
    shape: "window",
    min: 0,
    max: 1e12,
    platforms: ["instagram", "facebook"],
    freshDays: 30,
    help: "Accounts reached over a period you choose.",
  },
  {
    code: "impressions",
    label: "Impressions",
    unit: "count",
    scope: "account",
    shape: "window",
    min: 0,
    max: 1e12,
    platforms: ["instagram", "youtube", "facebook", "linkedin", "threads"],
    freshDays: 30,
    help: "Total over a period you choose.",
  },
  {
    code: "profile_views",
    label: "Profile views",
    unit: "count",
    scope: "account",
    shape: "window",
    min: 0,
    max: 1e12,
    platforms: ["instagram", "facebook", "linkedin", "threads"],
    freshDays: 30,
    help: "Total over a period you choose.",
  },
  {
    code: "interactions",
    label: "Account interactions",
    unit: "count",
    scope: "account",
    shape: "window",
    min: 0,
    max: 1e12,
    platforms: ["instagram", "youtube", "facebook", "linkedin", "threads"],
    freshDays: 30,
    help: "Likes, comments and similar actions over a period.",
  },
  {
    code: "audience_growth",
    label: "Audience growth (net change)",
    unit: "count",
    scope: "account",
    shape: "window",
    min: -1_000_000_000,
    max: 1_000_000_000,
    platforms: [
      "instagram",
      "youtube",
      "facebook",
      "linkedin",
      "threads",
      "other",
    ],
    freshDays: 30,
    help: "Net change in followers over a period. It can be negative.",
  },
  {
    code: "views",
    label: "Views",
    unit: "count",
    scope: "content",
    shape: "either",
    min: 0,
    max: 1e12,
    platforms: ["instagram", "youtube", "facebook", "linkedin", "threads"],
    freshDays: 30,
    help: "Lifetime total, or a total over a period.",
  },
  {
    code: "c_reach",
    label: "Reach",
    unit: "count",
    scope: "content",
    shape: "either",
    min: 0,
    max: 1e12,
    platforms: ["instagram", "facebook"],
    freshDays: 30,
    help: "Accounts reached by this item.",
  },
  {
    code: "c_impressions",
    label: "Impressions",
    unit: "count",
    scope: "content",
    shape: "either",
    min: 0,
    max: 1e12,
    platforms: ["instagram", "youtube", "facebook", "linkedin", "threads"],
    freshDays: 30,
    help: "Times this item was shown.",
  },
  {
    code: "likes",
    label: "Likes",
    unit: "count",
    scope: "content",
    shape: "either",
    min: 0,
    max: 1e12,
    platforms: ["instagram", "youtube", "facebook", "linkedin", "threads"],
    freshDays: 30,
    help: "Lifetime or period total.",
  },
  {
    code: "comments",
    label: "Comments",
    unit: "count",
    scope: "content",
    shape: "either",
    min: 0,
    max: 1e12,
    platforms: ["instagram", "youtube", "facebook", "linkedin", "threads"],
    freshDays: 30,
    help: "Lifetime or period total.",
  },
  {
    code: "shares",
    label: "Shares",
    unit: "count",
    scope: "content",
    shape: "either",
    min: 0,
    max: 1e12,
    platforms: ["instagram", "youtube", "facebook", "linkedin", "threads"],
    freshDays: 30,
    help: "Lifetime or period total.",
  },
  {
    code: "saves",
    label: "Saves",
    unit: "count",
    scope: "content",
    shape: "either",
    min: 0,
    max: 1e12,
    platforms: ["instagram"],
    freshDays: 30,
    help: "Lifetime or period total.",
  },
  {
    code: "watch_time_seconds",
    label: "Watch time",
    unit: "seconds",
    scope: "content",
    shape: "either",
    min: 0,
    max: 1e12,
    platforms: ["instagram", "youtube", "facebook"],
    freshDays: 30,
    help: "Total seconds watched.",
  },
];
export const metricCodes = metrics.map((m) => m.code) as string[];
export const metricOf = (code: string) => metrics.find((m) => m.code === code);
export const metricsFor = (platform: string, scope: MetricScope) =>
  metrics.filter((m) => m.scope === scope && m.platforms.includes(platform));
export const metricLabel = (code: string) => metricOf(code)?.label ?? code;
export const sources = [
  "manual",
  "screenshot_supported",
  "ai_confirmed",
  "provider",
] as const;
export type Source = (typeof sources)[number];
/** Provenance labels. These are NOT interchangeable: a screenshot or a confirmed AI value is never "verified", and nothing manual is ever "provider". */
export const sourceLabels: Record<Source, { label: string; detail: string }> = {
  manual: { label: "Self-reported", detail: "Entered by the Creator." },
  screenshot_supported: {
    label: "Self-reported, with a screenshot",
    detail:
      "Entered by the Creator and supported by their screenshot. Not independently verified.",
  },
  ai_confirmed: {
    label: "Extracted, then confirmed by the Creator",
    detail:
      "Suggested from a screenshot and confirmed by the Creator. Not independently verified.",
  },
  provider: {
    label: "From the platform",
    detail: "Retrieved through an authorized platform connection.",
  },
};
export type ObservationInput = {
  metric: string;
  platform: string;
  value: number;
  observedOn: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  today: string;
};
/** Mirrors the database rules so a form can explain a problem before it is submitted. The database remains authoritative. */
export function validateObservation(i: ObservationInput): Check {
  const m = metricOf(i.metric);
  if (!m || m.scope !== "account")
    return { ok: false, reason: "Choose a metric." };
  if (!m.platforms.includes(i.platform))
    return {
      ok: false,
      reason: `${m.label} is not available for this platform.`,
    };
  if (!Number.isFinite(i.value) || i.value < m.min || i.value > m.max)
    return {
      ok: false,
      reason: m.min < 0 ? "That number is out of range." : "Use zero or more.",
    };
  if (i.observedOn > i.today)
    return { ok: false, reason: "The date cannot be in the future." };
  const hasPeriod = !!i.periodStart || !!i.periodEnd;
  if (m.shape === "window") {
    if (!i.periodStart || !i.periodEnd)
      return { ok: false, reason: "Add the period this number covers." };
    if (i.periodEnd < i.periodStart || i.periodEnd > i.observedOn)
      return {
        ok: false,
        reason: "The period must end on or before the date.",
      };
  } else if (hasPeriod)
    return {
      ok: false,
      reason: `${m.label} is a single-date number, so it has no period.`,
    };
  return { ok: true };
}
