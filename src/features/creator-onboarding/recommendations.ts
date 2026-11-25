import { evaluateEligibility } from "./eligibility";
import type { CreatorState } from "./types";

/** Shape M10 will supply. M03 never creates these; they come only from genuinely published opportunities. */
export type Opportunity = {
  id: string;
  title: string;
  industry: string;
  platform?: string;
  category: string;
  niche?: string;
};
export type Recommendations = {
  opportunities: Opportunity[];
  empty: boolean;
  excludedCount: number;
  preparation: {
    id: string;
    title: string;
    detail: string;
    href: string | null;
  }[];
};
export interface OpportunitySource {
  listPublished(): Promise<Opportunity[]>;
}
/** M10 is not built, so the production source is empty. This returns nothing rather than inventing campaigns. */
export const noPublishedOpportunities: OpportunitySource = {
  async listPublished() {
    return [];
  },
};

export function recommend(
  state: CreatorState,
  published: Opportunity[],
): Recommendations {
  const excluded = new Set(state.industry_exclusions.map((e) => e.industry));
  const allowed = published.filter((o) => !excluded.has(o.industry));
  const platforms = new Set(state.social_accounts.map((a) => a.platform));
  const niches = new Set(state.niches.map((n) => n.code));
  const wanted = new Set(
    state.collaborations.filter((c) => c.interested).map((c) => c.category),
  );
  const score = (o: Opportunity) =>
    (o.niche && niches.has(o.niche) ? 2 : 0) +
    (o.platform && platforms.has(o.platform) ? 1 : 0) +
    (wanted.has(o.category) ? 1 : 0);
  const opportunities = [...allowed].sort(
    (a, b) => score(b) - score(a) || a.id.localeCompare(b.id),
  );
  const elig = evaluateEligibility(state);
  const preparation: Recommendations["preparation"] = [];
  if (!state.social_accounts.length)
    preparation.push({
      id: "account",
      title: "Add a social link when you have one",
      detail: "It is optional, but it helps shape what we suggest.",
      href: "/onboarding/creator/social",
    });
  if (elig.standardInfluencer.status !== "meets_follower_rule_unverified")
    preparation.push({
      id: "growth",
      title: "Focus on your growth plan",
      detail:
        "Standard influencer collaborations need one account with 100 or more followers. Growth tools are open to you now.",
      href: "/onboarding/creator/complete",
    });
  if (!state.collaborations.some((c) => c.interested))
    preparation.push({
      id: "prefs",
      title: "Say which collaborations interest you",
      detail: "Optional. You can focus only on growth.",
      href: "/onboarding/creator/preferences",
    });
  preparation.push({
    id: "portfolio",
    title: "Collect your best work in one place",
    detail: "A few strong examples will be useful when portfolio tools arrive.",
    href: null,
  });
  return {
    opportunities,
    empty: opportunities.length === 0,
    excludedCount: published.length - allowed.length,
    preparation,
  };
}
