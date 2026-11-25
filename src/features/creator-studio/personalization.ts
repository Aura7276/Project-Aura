import { evaluateEligibility } from "@/features/creator-onboarding/eligibility";
import type { CreatorState } from "@/features/creator-onboarding/types";
import { widgetIds, type WidgetId } from "./types";

/** Deterministic, rule-based. Not AI-generated. Personalization only orders and emphasizes; it never grants access or eligibility. */
export type Situation =
  "no_accounts" | "counts_unknown" | "below_100" | "qualifying";
export function situationOf(
  state: Pick<CreatorState, "profile" | "social_accounts" | "collaborations">,
): Situation {
  if (!state.social_accounts.length) return "no_accounts";
  const s = evaluateEligibility(state).standardInfluencer.status;
  return s === "meets_follower_rule_unverified"
    ? "qualifying"
    : s === "needs_account_info"
      ? "counts_unknown"
      : "below_100";
}
export const wantsUgc = (
  state: Pick<CreatorState, "profile" | "collaborations">,
) =>
  state.profile?.stage === "ugc_focused" ||
  state.collaborations.some((c) => c.category === "ugc" && c.interested);
const base: Record<Situation, WidgetId[]> = {
  no_accounts: [
    "actions",
    "plan",
    "content",
    "checklist",
    "goals",
    "weekly",
    "milestones",
    "recommendations",
    "commercial",
  ],
  counts_unknown: [
    "actions",
    "goals",
    "checklist",
    "content",
    "plan",
    "weekly",
    "recommendations",
    "milestones",
    "commercial",
  ],
  below_100: [
    "actions",
    "goals",
    "content",
    "plan",
    "weekly",
    "recommendations",
    "checklist",
    "milestones",
    "commercial",
  ],
  qualifying: [
    "actions",
    "goals",
    "content",
    "recommendations",
    "plan",
    "weekly",
    "commercial",
    "checklist",
    "milestones",
  ],
};
export function widgetOrder(
  state: CreatorState,
  hidden: readonly WidgetId[] = [],
  gamification = true,
): WidgetId[] {
  let order = [...base[situationOf(state)]];
  if (wantsUgc(state)) {
    order = order.filter((w) => w !== "recommendations");
    order.splice(Math.min(2, order.length), 0, "recommendations");
  }
  return order.filter(
    (w) =>
      !hidden.includes(w) &&
      (gamification || w !== "milestones") &&
      widgetIds.includes(w),
  );
}
export function headline(state: CreatorState, situation = situationOf(state)) {
  const name = state.profile?.display_name ?? "there";
  const lines: Record<Situation, string> = {
    no_accounts: `Welcome, ${name}. Let’s build your starting routine.`,
    counts_unknown: `Welcome back, ${name}. Add a follower count to sharpen your plan.`,
    below_100: `Welcome back, ${name}. Consistency is your best lever right now.`,
    qualifying: `Welcome back, ${name}. Keep your momentum going.`,
  };
  return lines[situation];
}
/** Notices that are never configurable widgets, so they cannot be hidden. */
export function essentialNotices(state: CreatorState) {
  const e = evaluateEligibility(state);
  const out = [
    {
      id: "private",
      text: "Your profile is private. It is not published or visible to Brands.",
    },
  ];
  if (e.socialOwnership.status === "unverified")
    out.push({
      id: "unverified",
      text: "Your account details are self-reported and unverified.",
    });
  return out;
}
