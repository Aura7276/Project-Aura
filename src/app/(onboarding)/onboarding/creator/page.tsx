import Link from "next/link";
import { redirect } from "next/navigation";
import { loadState } from "@/server/creator/service";
import { nextStep, progress } from "@/features/creator-onboarding/progress";
import { aiAvailability } from "@/features/creator-onboarding/ai";
import { Progress } from "@/features/creator-onboarding/step-shell";

export default async function Page() {
  const { state } = await loadState();
  if (state.profile?.activated_at) redirect("/onboarding/creator/complete");
  const next = nextStep(state);
  const started = Object.keys(state.onboarding?.steps ?? {}).length > 0;
  const ai = aiAvailability();
  const p = progress(state);
  return (
    <>
      <Progress current={next} statuses={state.onboarding?.steps ?? {}} />
      <h1>{started ? "Welcome back" : "Welcome to AURA"}</h1>
      <p className="ob-lede">
        {started
          ? `You have finished ${p.requiredDone} of ${p.requiredTotal} required steps. Pick up where you left off.`
          : "Build your private Creator profile. Resume anytime."}
      </p>
      <div className="ob-box">
        <details>
          <summary>What you’ll need</summary>
          <ul className="ob-list">
            <li>
              Three short required steps: about you, your niche and your goals.
            </li>
            <li>
              Everything else is optional. Skip anything, and add it later.
            </li>
            <li>
              You do not need followers, a social account or any Brand
              experience.
            </li>
            <li>Your profile stays private. Nothing is published.</li>
          </ul>
          {!ai.available && (
            <p className="ob-note" role="note">
              {ai.reason}
            </p>
          )}
        </details>
        <div className="ob-actions">
          <Link className="ob-btn primary" href={`/onboarding/creator/${next}`}>
            {started ? "Continue" : "Get started"}
          </Link>
        </div>
      </div>
    </>
  );
}
