"use client";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { ActionState } from "@/features/creator-onboarding/actions";
import { followingStep } from "@/features/creator-onboarding/progress";
import { parseSection } from "@/features/creator-onboarding/schemas";
import { allSteps, type StepId } from "@/features/creator-onboarding/types";
import {
  ChallengesStep,
  GoalsStep,
  IdentityStep,
  NicheStep,
  PreferencesStep,
  RatesStep,
  ResourcesStep,
  SocialStep,
} from "@/features/creator-onboarding/steps";
import * as init from "@/features/creator-onboarding/initials";
import type { CreatorState } from "@/features/creator-onboarding/types";

/** Development preview only. Uses the real validators but persists nothing and has no identity. */
export function PreviewStep({
  step,
  state,
}: {
  step: StepId;
  state: CreatorState;
}) {
  const router = useRouter();
  const action = useCallback(
    async (_prev: ActionState, form: FormData): Promise<ActionState> => {
      const intent = String(form.get("intent") ?? "continue");
      const which = form.get("step") as StepId;
      if (!allSteps.includes(which)) return { message: "Unknown step." };
      if (intent === "skip") {
        router.push(`/dev/onboarding-preview/${followingStep(which)}`);
        return null;
      }
      let raw: unknown = {};
      try {
        raw = JSON.parse(String(form.get("payload")));
      } catch {
        /* validated below */
      }
      const r = parseSection(which, raw);
      if (!r.ok)
        return {
          errors: r.errors,
          message: "Please fix the highlighted fields.",
        };
      router.push(
        intent === "save_exit"
          ? "/dev/onboarding-preview/identity"
          : `/dev/onboarding-preview/${followingStep(which)}`,
      );
      return null;
    },
    [router],
  );
  const common = {
    revision: 0,
    action,
    statuses: {},
    backHref: "/dev/onboarding-preview/identity",
  };
  switch (step) {
    case "identity":
      return <IdentityStep {...common} initial={init.identityInit(state)} />;
    case "social":
      return <SocialStep {...common} initial={init.socialInit(state)} />;
    case "niche":
      return <NicheStep {...common} initial={init.nicheInit(state)} />;
    case "goals":
      return <GoalsStep {...common} initial={init.goalsInit(state)} />;
    case "challenges":
      return (
        <ChallengesStep {...common} initial={init.challengesInit(state)} />
      );
    case "preferences":
      return (
        <PreferencesStep {...common} initial={init.preferencesInit(state)} />
      );
    case "rates":
      return <RatesStep {...common} initial={init.ratesInit(state)} />;
    case "resources":
      return <ResourcesStep {...common} initial={init.resourcesInit(state)} />;
  }
}
