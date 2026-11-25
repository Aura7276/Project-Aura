import {
  mandatorySteps,
  stepOrder,
  type CreatorState,
  type StepId,
} from "./types";

export function stepStatus(state: CreatorState, step: StepId) {
  return state.onboarding?.steps[step] ?? "unanswered"; // unanswered and skipped are distinct
}
/** Mirrors the database readiness rule, which remains authoritative at activation. */
export function missingMandatory(state: CreatorState): StepId[] {
  const p = state.profile;
  const missing: StepId[] = [];
  if (!(p?.display_name && p.country && p.language && p.stage))
    missing.push("identity");
  if (!(p?.niche_exploring || state.niches.some((n) => n.role === "primary")))
    missing.push("niche");
  if (!state.goals.length) missing.push("goals");
  return missing;
}
export const canActivate = (state: CreatorState) =>
  missingMandatory(state).length === 0 && !state.profile?.activated_at;
/** The first flow step that is neither completed nor deliberately skipped; otherwise the review. */
export function nextStep(state: CreatorState): StepId | "review" {
  for (const step of stepOrder) {
    if (stepStatus(state, step) === "unanswered") return step;
  }
  return "review";
}
export function progress(state: CreatorState) {
  const done = mandatorySteps.filter(
    (s) => !missingMandatory(state).includes(s),
  ).length;
  return {
    requiredDone: done,
    requiredTotal: mandatorySteps.length,
    activated: !!state.profile?.activated_at,
  };
}
export const stepHeading: Record<StepId | "review", string> = {
  identity: "About you",
  social: "Your accounts",
  niche: "Your niche",
  goals: "Your goals",
  challenges: "Your challenges",
  preferences: "Collaboration preferences",
  rates: "Your rates",
  resources: "Time and tools",
  review: "Review",
};

export function followingStep(step: StepId): string {
  const i = stepOrder.indexOf(step);
  return i >= 0 && i < stepOrder.length - 1
    ? stepOrder[i + 1]
    : step === "rates" || step === "resources"
      ? "complete"
      : "review";
}
