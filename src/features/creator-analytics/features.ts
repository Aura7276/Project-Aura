// M06-F23: core analytics are free; advanced intelligence and reporting MAY be premium later. Entitlements are not enforced yet (M27 does not exist),
// so everything is available. This registry marks the intended tiers so M27 can attach to it.
export type Tier = "core" | "advanced";
export const features: Record<string, { label: string; tier: Tier }> = {
  accounts: { label: "Account analytics and history", tier: "core" },
  content: { label: "Content analytics", tier: "core" },
  audience: { label: "Audience observations", tier: "core" },
  compare: { label: "Content comparison", tier: "core" },
  experiments: { label: "Growth Experiment Lab", tier: "core" },
  insights: { label: "Insight feed", tier: "core" },
  patterns: { label: "Pattern analysis", tier: "advanced" },
  timing: { label: "Publishing-time analysis", tier: "advanced" },
  forecast: { label: "Scenario ranges", tier: "advanced" },
  cohort: { label: "Peer cohort benchmarks", tier: "advanced" },
  reports: { label: "PDF summaries", tier: "advanced" },
  csv: { label: "CSV export", tier: "core" },
};
export const entitlementsEnforced = false;
export const canUse = (feature: keyof typeof features) => feature in features; // M27 will replace this with an entitlement lookup
