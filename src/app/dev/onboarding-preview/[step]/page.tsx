import { notFound } from "next/navigation";
import "@/features/creator-onboarding/onboarding.css";
import {
  allSteps,
  type CreatorState,
  type StepId,
} from "@/features/creator-onboarding/types";
import {
  buildChecklist,
  checklistSummary,
} from "@/features/creator-onboarding/checklist";
import { recommend } from "@/features/creator-onboarding/recommendations";
import {
  generateInitialPlan,
  planDisclosure,
} from "@/features/creator-onboarding/plan";
import {
  EligibilityPanel,
  SummaryList,
} from "@/features/creator-onboarding/summary";
import { PreviewStep } from "../preview-client";

export const metadata = {
  title: "Creator onboarding preview",
  robots: { index: false, follow: false },
};
// Illustrative record, used only by this development preview. It is not a real Creator.
const sample: CreatorState = {
  workspace_id: "preview",
  profile: {
    display_name: "Illustrative Creator",
    country: "IN",
    city: null,
    language: "en",
    bio: null,
    stage: "emerging",
    niche_exploring: false,
    prior_collaboration: null,
    restrictions: null,
    visibility: "private",
    activated_at: "2026-11-25T00:00:00Z",
    updated_at: "2026-11-25T00:00:00Z",
  },
  onboarding: {
    revision: 1,
    current_step: "review",
    steps: {},
    ai_assisted: false,
  },
  niches: [{ role: "primary", code: "food", custom_label: null }],
  social_accounts: [
    {
      platform: "instagram",
      handle: "illustrative",
      profile_url: null,
      account_type: "personal",
      ownership_scope: "individual",
      visibility: "public",
      self_reported_followers: 60,
      observed_on: "2026-11-01",
      is_primary: true,
    },
  ],
  goals: [
    {
      category: "audience_growth",
      metric: null,
      baseline_kind: "unknown",
      baseline_value: null,
      target_value: null,
      currency: null,
      timeframe_days: null,
      details: null,
    },
  ],
  challenges: [],
  resources: null,
  collaborations: [],
  industry_preferences: [],
  industry_exclusions: [{ industry: "alcohol", note: null }],
  rates: [],
  plan: null,
};
const blank: CreatorState = {
  ...sample,
  profile: {
    ...sample.profile!,
    display_name: null,
    country: null,
    language: null,
    stage: null,
    activated_at: null,
  },
  niches: [],
  social_accounts: [],
  goals: [],
  industry_exclusions: [],
};
export default async function Page({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step } = await params;
  if (step === "summary") {
    const plan = generateInitialPlan(sample);
    const items = buildChecklist(sample);
    const sum = checklistSummary(items);
    const recs = recommend(sample, []);
    return (
      <div className="ob">
        <p className="ob-preview-banner">
          Development preview of illustrative data. Nothing is saved.
        </p>
        <main className="ob-main ob-wide" id="content">
          <h1>Summary preview</h1>
          <div className="ob-grid two">
            <section className="ob-box" aria-labelledby="p">
              <h2 id="p">Your first seven days</h2>
              <p className="ob-hint">{planDisclosure}</p>
              <ol className="ob-list">
                {plan.actions.map((a, i) => (
                  <li key={i}>
                    <span>
                      <strong>
                        Day {a.day}: {a.title}
                      </strong>
                      <br />
                      <small>{a.detail}</small>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
            <section className="ob-box" aria-labelledby="c">
              <h2 id="c">Profile checklist</h2>
              <p className="ob-hint">
                {sum.requiredDone} of {sum.requiredTotal} required done.
              </p>
              <ul className="ob-list">
                {items.map((i) => (
                  <li key={i.id}>
                    {i.label}: {i.state}
                  </li>
                ))}
              </ul>
            </section>
            <section className="ob-box" aria-labelledby="o">
              <h2 id="o">Opportunities</h2>
              {recs.empty && <p>No published opportunities yet.</p>}
            </section>
            <section className="ob-box" aria-labelledby="s">
              <h2 id="s">Summary</h2>
              <SummaryList state={sample} editable={false} />
            </section>
            <section className="ob-box" aria-labelledby="e">
              <h2 id="e">Where you stand</h2>
              <EligibilityPanel state={sample} />
            </section>
          </div>
        </main>
      </div>
    );
  }
  if (!allSteps.includes(step as StepId)) notFound();
  return (
    <div className="ob">
      <p className="ob-preview-banner">
        Development preview. Nothing is saved and there is no sign-in.
      </p>
      <main className="ob-main" id="content">
        <PreviewStep step={step as StepId} state={blank} />
      </main>
    </div>
  );
}
