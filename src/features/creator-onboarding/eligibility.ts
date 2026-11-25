import type { CreatorState, SocialAccount } from "./types";

export const standardFollowerThreshold = 100;
export const followerSegments = [
  {
    id: "none_or_under_100",
    label: "No account or 0–99 followers",
    min: 0,
    max: 99,
  },
  { id: "100_999", label: "100–999 followers", min: 100, max: 999 },
  { id: "1k_4999", label: "1,000–4,999 followers", min: 1000, max: 4999 },
  { id: "5k_9999", label: "5,000–9,999 followers", min: 5000, max: 9999 },
  { id: "10k_19999", label: "10,000–19,999 followers", min: 10000, max: 19999 },
  {
    id: "20k_plus",
    label: "20,000 or more followers",
    min: 20000,
    max: Infinity,
  },
] as const;
export type SegmentId = (typeof followerSegments)[number]["id"] | "unknown";

/** A "relevant individual account" is one the Creator declares as their own (not a Brand or company page). */
export const isIndividualAccount = (
  a: Pick<SocialAccount, "ownership_scope">,
) => a.ownership_scope === "individual";

/** Followers are never added together across accounts: only the single best individual account counts. */
export function bestIndividualFollowers(
  accounts: SocialAccount[],
): number | null {
  const known = accounts
    .filter(isIndividualAccount)
    .map((a) => a.self_reported_followers)
    .filter((n): n is number => n !== null);
  return known.length ? Math.max(...known) : null;
}
export function followerSegment(accounts: SocialAccount[]): SegmentId {
  if (!accounts.length) return "none_or_under_100"; // no account at all is its own known state
  const best = bestIndividualFollowers(accounts);
  if (best === null) return "unknown"; // unknown stays unknown
  return followerSegments.find((s) => best >= s.min && best <= s.max)!.id;
}

export type Eligibility = {
  workspaceActivation: { status: "active" | "not_active"; text: string };
  growthTools: { status: "available" | "after_activation"; text: string };
  standardInfluencer: {
    status: "meets_follower_rule_unverified" | "not_yet" | "needs_account_info";
    text: string;
    qualifyingAccount: string | null;
  };
  ugc: { status: "needs_assessment" | "not_requested"; text: string };
  socialOwnership: { status: "no_accounts" | "unverified"; text: string };
  commercialVerification: {
    status: "required_before_commercial_activity";
    text: string;
  };
  campaignSpecific: { status: "determined_per_campaign"; text: string };
};

export function evaluateEligibility(
  state: Pick<CreatorState, "profile" | "social_accounts" | "collaborations">,
): Eligibility {
  const active = !!state.profile?.activated_at;
  const accounts = state.social_accounts;
  const qualifying =
    accounts.find(
      (a) =>
        isIndividualAccount(a) &&
        (a.self_reported_followers ?? -1) >= standardFollowerThreshold,
    ) ?? null;
  const individualKnown = accounts.some(
    (a) => isIndividualAccount(a) && a.self_reported_followers !== null,
  );
  const best = bestIndividualFollowers(accounts);
  let standard: Eligibility["standardInfluencer"];
  if (qualifying)
    standard = {
      status: "meets_follower_rule_unverified",
      qualifyingAccount: `${qualifying.platform}:${qualifying.handle}`,
      text: `Your self-reported follower count on one account meets the 100-follower guide for standard influencer collaborations. Ownership still has to be verified before it counts for commercial work.`,
    };
  else if (accounts.some(isIndividualAccount) && !individualKnown)
    standard = {
      status: "needs_account_info",
      qualifyingAccount: null,
      text: "Add a follower count to one of your own accounts to see whether it meets the 100-follower guide.",
    };
  else
    standard = {
      status: "not_yet",
      qualifyingAccount: null,
      text:
        accounts.length && best !== null
          ? `Standard influencer collaborations need at least one of your own accounts with 100 or more followers. Your highest reported count is ${best}. Followers on separate accounts are not added together.`
          : "Standard influencer collaborations need at least one of your own accounts with 100 or more followers. You can still use all the growth tools.",
    };
  const wantsUgc =
    state.collaborations.some((c) => c.category === "ugc" && c.interested) ||
    state.profile?.stage === "ugc_focused";
  return {
    workspaceActivation: active
      ? { status: "active", text: "Your Creator workspace is active." }
      : {
          status: "not_active",
          text: "Finish the required steps to activate your workspace.",
        },
    growthTools: active
      ? {
          status: "available",
          text: "Growth tools are available to you. They do not depend on followers or accounts.",
        }
      : {
          status: "after_activation",
          text: "Growth tools unlock when your workspace is activated.",
        },
    standardInfluencer: standard,
    ugc: wantsUgc
      ? {
          status: "needs_assessment",
          text: "UGC is assessed separately from follower count. The assessment criteria are not published yet, so your UGC eligibility is still to be assessed.",
        }
      : {
          status: "not_requested",
          text: "UGC is assessed separately from followers. Add UGC to your collaboration interests whenever you are ready.",
        },
    socialOwnership: accounts.length
      ? {
          status: "unverified",
          text: "Your account details are self-reported and unverified. Ownership verification arrives with social account management.",
        }
      : {
          status: "no_accounts",
          text: "No social accounts added. Nothing needs verifying.",
        },
    commercialVerification: {
      status: "required_before_commercial_activity",
      text: "Verification is optional now and required before designated commercial activities.",
    },
    campaignSpecific: {
      status: "determined_per_campaign",
      text: "Each campaign sets its own requirements, checked when you apply.",
    },
  };
}
// Integration point for M10/M11: campaign requirements are evaluated by the campaign module, never guessed here.
export interface CampaignRequirementEvaluator {
  evaluate(
    campaignId: string,
    state: CreatorState,
  ): Promise<{ eligible: boolean; reasons: string[] }>;
}
