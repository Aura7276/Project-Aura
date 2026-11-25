import {
  evaluateEligibility,
  standardFollowerThreshold,
  type Eligibility,
} from "@/features/creator-onboarding/eligibility";
import type {
  CreatorState,
  SocialAccount,
} from "@/features/creator-onboarding/types";

const tracked = (a: SocialAccount) =>
  !a.lifecycle || a.lifecycle === "active" || a.lifecycle === "disconnected"; // removed and archived accounts never count
export const trackedAccounts = (accounts: SocialAccount[]) =>
  accounts.filter(tracked);
/** The authoritative eligibility service for accounts. It reuses the M03 engine on tracked accounts only and adds ownership and visibility facts. */
export function accountEligibility(
  state: Pick<CreatorState, "profile" | "social_accounts" | "collaborations">,
): Eligibility & {
  paidInfluencer: {
    ownershipRequired: true;
    ownershipSatisfied: boolean;
    text: string;
  };
  privateAccounts: { count: number; text: string | null };
} {
  const accounts = trackedAccounts(state.social_accounts);
  const base = evaluateEligibility({ ...state, social_accounts: accounts });
  const qualifying = accounts.filter(
    (a) =>
      (a.ownership_scope ?? "individual") === "individual" &&
      (a.self_reported_followers ?? -1) >= standardFollowerThreshold,
  );
  const verified = qualifying.some((a) => a.verification === "verified");
  const priv = accounts.filter((a) => a.visibility === "private");
  return {
    ...base,
    socialOwnership: accounts.length
      ? {
          status: "unverified",
          text: accounts.some((a) => a.verification === "verified")
            ? "At least one account has verified ownership. Metrics remain self-reported."
            : "Your account details are self-reported and unverified. Verify ownership to prepare for paid collaborations.",
        }
      : base.socialOwnership,
    paidInfluencer: {
      ownershipRequired: true,
      ownershipSatisfied: verified,
      text: verified
        ? "Ownership of a qualifying account is verified, which paid influencer collaborations require."
        : "Paid influencer collaborations need verified ownership of a qualifying account (one of your own with 100 or more followers). Verification is separate from follower count.",
    },
    privateAccounts: {
      count: priv.length,
      text: priv.length
        ? "Private accounts work for all growth tools. Discovery and some campaigns may need a public or verified account."
        : null,
    },
  };
}
/** The check M11/M12 must call before accepting a designated paid influencer collaboration. UGC is evaluated separately and never uses this. */
export function paidInfluencerGate(accounts: SocialAccount[]): {
  allowed: boolean;
  reasons: string[];
} {
  const t = trackedAccounts(accounts);
  const qualifying = t.filter(
    (a) =>
      (a.ownership_scope ?? "individual") === "individual" &&
      (a.self_reported_followers ?? -1) >= standardFollowerThreshold,
  ); // never summed
  const reasons: string[] = [];
  if (!qualifying.length)
    reasons.push("No relevant individual account with 100 or more followers.");
  else if (!qualifying.some((a) => a.verification === "verified"))
    reasons.push("Ownership of a qualifying account is not verified.");
  return { allowed: reasons.length === 0, reasons };
}
