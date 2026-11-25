// Independent status dimensions (never one ambiguous field). Mirrors the database; transitions are documented in SOCIAL_VERIFICATION_ARCHITECTURE.md.
export const lifecycleStates = [
  "active",
  "disconnected",
  "removed",
  "archived",
] as const;
export const ownershipStates = [
  "unverified",
  "challenge_pending",
  "evidence_submitted",
  "under_review",
  "verified",
  "rejected",
  "disputed",
  "revoked",
] as const;
export type Ownership = (typeof ownershipStates)[number];
export type Lifecycle = (typeof lifecycleStates)[number];
export const ownershipLabels: Record<
  Ownership,
  { label: string; detail: string; tone: "neutral" | "info" | "ok" | "warn" }
> = {
  unverified: {
    label: "Unverified",
    detail: "Self-reported. Ownership has not been checked.",
    tone: "neutral",
  },
  challenge_pending: {
    label: "Verification started",
    detail: "Add your code to your profile, then send it for review.",
    tone: "info",
  },
  evidence_submitted: {
    label: "Evidence added",
    detail: "Send your verification for review when you are ready.",
    tone: "info",
  },
  under_review: {
    label: "Under review",
    detail: "A reviewer will check your verification.",
    tone: "info",
  },
  verified: {
    label: "Ownership verified",
    detail:
      "A reviewer confirmed you control this account. Your metrics are still self-reported.",
    tone: "ok",
  },
  rejected: {
    label: "Not verified",
    detail: "The reviewer could not confirm ownership. You can try again.",
    tone: "warn",
  },
  disputed: {
    label: "Under review (claim conflict)",
    detail: "This account needs a closer review before it can be verified.",
    tone: "warn",
  },
  revoked: {
    label: "Verification removed",
    detail: "Verification no longer applies. You can start again.",
    tone: "warn",
  },
};
export const lifecycleLabels: Record<Lifecycle, string> = {
  active: "Active",
  disconnected: "Disconnected",
  removed: "Removed",
  archived: "Archived",
};
export const claimStates = [
  "challenge_pending",
  "evidence_submitted",
  "under_review",
  "verified",
  "rejected",
  "disputed",
  "revoked",
] as const;
export type ClaimState = (typeof claimStates)[number];
export type Actor = "creator" | "reviewer" | "system";
/** The permitted ownership-claim transitions and who may perform them. */
export const claimTransitions: {
  from: ClaimState;
  to: ClaimState;
  by: Actor;
  via: string;
}[] = [
  {
    from: "challenge_pending",
    to: "evidence_submitted",
    by: "creator",
    via: "submit evidence",
  },
  {
    from: "challenge_pending",
    to: "under_review",
    by: "creator",
    via: "request review",
  },
  {
    from: "evidence_submitted",
    to: "under_review",
    by: "creator",
    via: "request review",
  },
  { from: "challenge_pending", to: "revoked", by: "creator", via: "withdraw" },
  { from: "evidence_submitted", to: "revoked", by: "creator", via: "withdraw" },
  { from: "under_review", to: "revoked", by: "creator", via: "withdraw" },
  {
    from: "challenge_pending",
    to: "revoked",
    by: "system",
    via: "challenge expired, handle changed or account removed",
  },
  { from: "under_review", to: "verified", by: "reviewer", via: "approve" },
  { from: "under_review", to: "rejected", by: "reviewer", via: "reject" },
  {
    from: "under_review",
    to: "challenge_pending",
    by: "reviewer",
    via: "request more evidence",
  },
  {
    from: "evidence_submitted",
    to: "verified",
    by: "reviewer",
    via: "approve",
  },
  { from: "evidence_submitted", to: "rejected", by: "reviewer", via: "reject" },
  {
    from: "disputed",
    to: "verified",
    by: "reviewer",
    via: "approve (explicit replace of the existing owner)",
  },
  {
    from: "disputed",
    to: "rejected",
    by: "reviewer",
    via: "reject (existing owner upheld)",
  },
  { from: "disputed", to: "revoked", by: "creator", via: "withdraw" },
  { from: "verified", to: "revoked", by: "reviewer", via: "revoke" },
  {
    from: "verified",
    to: "revoked",
    by: "system",
    via: "handle changed, account removed or dispute resolved elsewhere",
  },
];
export const canTransition = (from: ClaimState, to: ClaimState, by: Actor) =>
  claimTransitions.some((t) => t.from === from && t.to === to && t.by === by);
export const isOpenClaim = (s: string) =>
  [
    "challenge_pending",
    "evidence_submitted",
    "under_review",
    "disputed",
  ].includes(s);
