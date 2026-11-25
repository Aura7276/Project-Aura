import { notFound, redirect } from "next/navigation";
import { creatorContext, loadState } from "@/server/creator/service";
import { saveStep, activate } from "@/features/creator-onboarding/actions";
import { allSteps, type StepId } from "@/features/creator-onboarding/types";
import { missingMandatory } from "@/features/creator-onboarding/progress";
import { Progress } from "@/features/creator-onboarding/step-shell";
import { SummaryList } from "@/features/creator-onboarding/summary";
import * as init from "@/features/creator-onboarding/initials";
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
import { identityDefaults } from "@/server/creator/defaults";

const order: StepId[] = [
  "identity",
  "social",
  "niche",
  "goals",
  "challenges",
  "preferences",
];
const errorText: Record<string, string> = {
  incomplete: "A few required answers are still missing.",
  conflict: "This was changed in another tab. Reload and try again.",
  invalid: "Something could not be saved. Please check and try again.",
  rate: "Please wait a moment and try again.",
  failed:
    "We could not finish activating just now. Nothing was lost. Please try again.",
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ step: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { step } = await params;
  const { error } = await searchParams;
  await creatorContext(); // authenticate before revealing anything about which routes exist
  if (step !== "review" && !allSteps.includes(step as StepId)) notFound();
  const { state, user } = await loadState();
  const activated = !!state.profile?.activated_at;
  const rev = state.onboarding?.revision ?? 0;
  const statuses = state.onboarding?.steps ?? {};
  const back = (s: StepId) => {
    const i = order.indexOf(s);
    return i > 0
      ? `/onboarding/creator/${order[i - 1]}`
      : activated
        ? "/onboarding/creator/profile"
        : "/onboarding/creator";
  };
  const common = { revision: rev, action: saveStep, statuses };
  if (step === "review") {
    if (activated) redirect("/onboarding/creator/complete");
    const missing = missingMandatory(state);
    return (
      <>
        <Progress current="review" statuses={statuses} />
        <h1>Review your answers</h1>
        <p className="ob-lede">
          Check everything looks right. You can change any of it later.
        </p>
        {error && (
          <p className="ob-note warn" role="alert">
            {errorText[error] ?? errorText.failed}
          </p>
        )}
        <SummaryList state={state} />
        {missing.length > 0 ? (
          <p className="ob-note warn" role="alert">
            Still needed: {missing.join(", ")}. Use Edit above to finish them.
          </p>
        ) : (
          <form action={activate} className="ob-actions">
            <input type="hidden" name="request" value={crypto.randomUUID()} />
            <button className="ob-btn primary">Activate my workspace</button>
          </form>
        )}
      </>
    );
  }
  const s = step as StepId;
  const backHref = back(s);
  const notice = error ? (
    <p className="ob-note warn" role="alert">
      {errorText[error] ?? errorText.failed}
    </p>
  ) : null;
  return (
    <>
      {notice}
      {s === "identity" && (
        <IdentityStep
          {...common}
          backHref={backHref}
          initial={init.identityInit(state, identityDefaults(user))}
        />
      )}
      {s === "social" && (
        <SocialStep
          {...common}
          backHref={backHref}
          initial={init.socialInit(state)}
        />
      )}
      {s === "niche" && (
        <NicheStep
          {...common}
          backHref={backHref}
          initial={init.nicheInit(state)}
        />
      )}
      {s === "goals" && (
        <GoalsStep
          {...common}
          backHref={backHref}
          initial={init.goalsInit(state)}
        />
      )}
      {s === "challenges" && (
        <ChallengesStep
          {...common}
          backHref={backHref}
          initial={init.challengesInit(state)}
        />
      )}
      {s === "preferences" && (
        <PreferencesStep
          {...common}
          backHref={backHref}
          initial={init.preferencesInit(state)}
        />
      )}
      {s === "rates" && (
        <RatesStep
          {...common}
          backHref="/onboarding/creator/profile"
          initial={init.ratesInit(state)}
        />
      )}
      {s === "resources" && (
        <ResourcesStep
          {...common}
          backHref="/onboarding/creator/profile"
          initial={init.resourcesInit(state)}
        />
      )}
    </>
  );
}
