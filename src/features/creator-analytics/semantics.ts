// Mirrors aura_analytics.metric_semantics v1 (drift is test-checked). The M05 dictionary stays the authority for units, ranges and platforms.
export type Aggregation =
  | "per_account"
  | "per_content"
  | "sum"
  | "sum_same_window"
  | "sum_with_overlap_label";
export const aggregations: Record<string, Aggregation[]> = {
  followers: ["per_account", "sum_with_overlap_label"],
  following: ["per_account"],
  posts_total: ["per_account", "sum"],
  reach: ["per_account"],
  impressions: ["per_account", "sum_same_window"],
  profile_views: ["per_account", "sum_same_window"],
  interactions: ["per_account", "sum_same_window"],
  audience_growth: ["per_account", "sum_same_window"],
  views: ["per_content"],
  c_reach: ["per_content"],
  c_impressions: ["per_content"],
  likes: ["per_content"],
  comments: ["per_content"],
  shares: ["per_content"],
  saves: ["per_content"],
  watch_time_seconds: ["per_content"],
};
export const canSum = (metric: string) =>
  (aggregations[metric] ?? []).some(
    (a) => a === "sum" || a === "sum_same_window",
  );
export const overlapLabelled = (metric: string) =>
  (aggregations[metric] ?? []).includes("sum_with_overlap_label");
export const definitionVersion = 1;
export const caveats: Record<string, string> = {
  followers:
    "A platform-account count, not unique people. Someone who follows you in two places is counted twice.",
  reach:
    "Unique accounts. Cannot be added across accounts, platforms or periods.",
  impressions: "Times shown, not people. Not interchangeable with reach.",
  views: "Platform-defined views, not unique viewers.",
  interactions: "Which interactions are included differs by platform.",
};
