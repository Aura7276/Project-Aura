import { rateFormats, goalCategories } from "./taxonomy";
import { fromMinor } from "./money";
import type { CreatorState } from "./types";
import type {
  ChallengesInit,
  GoalsInit,
  IdentityInit,
  NicheInit,
  PreferencesInit,
  RatesInit,
  ResourcesInit,
  SocialInit,
} from "./steps";

export type Defaults = { name?: string; country?: string };
/** Pre-fills from persisted onboarding data, then from M02 identity metadata so nothing is re-entered. */
export function identityInit(s: CreatorState, d: Defaults = {}): IdentityInit {
  const p = s.profile;
  return {
    display_name: p?.display_name ?? d.name ?? "",
    country: p?.country ?? d.country ?? "",
    city: p?.city ?? "",
    language: p?.language ?? "",
    bio: p?.bio ?? "",
    stage: p?.stage ?? "",
  };
}
export const socialInit = (s: CreatorState): SocialInit => ({
  none:
    s.onboarding?.steps.social === "completed" &&
    s.social_accounts.length === 0,
  accounts: s.social_accounts.map((a) => ({
    platform: a.platform,
    handle: a.handle,
    profile_url: a.profile_url ?? "",
    account_type: a.account_type ?? "",
    ownership_scope: a.ownership_scope,
    visibility: a.visibility,
    self_reported_followers: a.self_reported_followers?.toString() ?? "",
    observed_on: a.observed_on ?? "",
    is_primary: a.is_primary,
  })),
});
export function nicheInit(s: CreatorState): NicheInit {
  const primary = s.niches.find((n) => n.role === "primary");
  return {
    exploring: !!s.profile?.niche_exploring,
    primary: primary?.code ?? "",
    primaryCustom: primary?.custom_label ?? "",
    secondary: s.niches
      .filter((n) => n.role === "secondary" && n.code !== "custom")
      .map((n) => n.code),
    interests: s.niches
      .filter((n) => n.role === "interest" && n.code !== "custom")
      .map((n) => n.code),
    customInterest:
      s.niches.find((n) => n.role === "interest" && n.code === "custom")
        ?.custom_label ?? "",
  };
}
export function goalsInit(s: CreatorState): GoalsInit {
  const details: GoalsInit["details"] = {};
  for (const g of s.goals)
    details[g.category] = {
      metric: g.metric ?? "",
      baseline: g.baseline_value?.toString() ?? "",
      target: g.target_value?.toString() ?? "",
      timeframe_days: g.timeframe_days?.toString() ?? "",
      currency: g.currency ?? "INR",
    };
  return {
    selected: s.goals
      .map((g) => g.category)
      .filter((c) => goalCategories.some(([k]) => k === c)),
    details,
  };
}
export const challengesInit = (s: CreatorState): ChallengesInit => ({
  selected: s.challenges.map((c) => c.code),
  details: Object.fromEntries(
    s.challenges
      .filter((c) => c.detail)
      .map((c) => [c.code, c.detail as string]),
  ),
});
export const preferencesInit = (s: CreatorState): PreferencesInit => ({
  collaborations: s.collaborations
    .filter((c) => c.interested)
    .map((c) => c.category),
  prior_collaboration: s.profile?.prior_collaboration ?? "",
  preferred: s.industry_preferences
    .filter((i) => i.stance === "preferred")
    .map((i) => i.industry),
  considering: s.industry_preferences
    .filter((i) => i.stance === "considering")
    .map((i) => i.industry),
  exclusions: s.industry_exclusions.map((i) => i.industry),
  restrictions: s.profile?.restrictions ?? "",
});
export const ratesInit = (s: CreatorState): RatesInit => ({
  rows: rateFormats.map(([format]) => {
    const r = s.rates.find((x) => x.format === format);
    return {
      format,
      enabled: !!r,
      amount: fromMinor(r?.amount_minor ?? null),
      currency: r?.currency ?? "INR",
      negotiable: r?.negotiable ?? true,
      unsure: r?.unsure ?? false,
    };
  }),
});
export const resourcesInit = (s: CreatorState): ResourcesInit => ({
  hours_per_week: s.resources?.hours_per_week?.toString() ?? "",
  posts_per_week: s.resources?.posts_per_week?.toString() ?? "",
  equipment: s.resources?.equipment ?? [],
  budget: fromMinor(s.resources?.budget_minor ?? null),
  budget_currency: s.resources?.budget_currency ?? "INR",
});
