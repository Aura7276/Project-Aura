// Stable integration entry points for later modules. M03 does not implement any of them.
/** M04 Creator dashboard mounts here. Until it exists, M03 serves the completion screen at the fallback. */
export const m04DashboardEntry = "/creator" as const;
export const m03ContinuationHref = "/onboarding/creator/complete" as const;
export const integrationBoundaries = {
  M04: "Creator dashboard: consumes aura_creator_state() and the persisted plan and checklist.",
  M05: "Social account management: extends aura_creator.social_account (verification, provenance, refresh).",
  M07: "AI Growth Assistant: implements AiOnboardingProvider; suggestions need user confirmation.",
  M09: "Creator profile and media kit: owns publication; M03 profiles are private-only.",
  M10: "Campaign marketplace: implements OpportunitySource and CampaignRequirementEvaluator.",
  M25: "Notifications: delivers the reminders M03 computes in-app.",
} as const;
export const reminderAfterDays = 90;
/** In-app reminder only. Real delivery (email/push) needs M25. */
export function reminderDue(
  updatedAt: string | null | undefined,
  now = Date.now(),
) {
  if (!updatedAt) return false;
  return now - new Date(updatedAt).getTime() > reminderAfterDays * 86_400_000;
}
