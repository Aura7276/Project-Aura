import Link from "next/link";
import type { CreatorState } from "./types";
import { evaluateEligibility } from "./eligibility";
import {
  challenges,
  collaborationCategories,
  countries,
  goalCategories,
  industries,
  label,
  languages,
  niches,
  platforms,
  stages,
} from "./taxonomy";

const none = <span>Not added</span>;
export function SummaryList({
  state,
  editable = true,
}: {
  state: CreatorState;
  editable?: boolean;
}) {
  const p = state.profile;
  const primary = state.niches.find((n) => n.role === "primary");
  const edit = (step: string, text: string) =>
    editable && <Link href={`/onboarding/creator/${step}`}>{text}</Link>;
  const e = evaluateEligibility(state);
  return (
    <dl className="ob-summary">
      <div>
        <dt>About you {edit("identity", "Edit")}</dt>
        <dd>
          {p?.display_name ?? "—"} · {label(countries, p?.country ?? "")} ·{" "}
          {label(languages, p?.language ?? "")} ·{" "}
          {p?.stage ? stages.find(([c]) => c === p.stage)?.[1] : "—"}
        </dd>
      </div>
      <div>
        <dt>Social accounts {edit("social", "Edit")}</dt>
        <dd>
          {state.social_accounts.length
            ? state.social_accounts
                .map(
                  (a) =>
                    `${label(platforms, a.platform)} @${a.handle}${a.is_primary ? " (main)" : ""}${a.self_reported_followers !== null ? ` · ${a.self_reported_followers} followers, self-reported` : ""}`,
                )
                .join("; ")
            : "None yet. That is fine."}
          {state.social_accounts.length > 0 && (
            <>
              {" "}
              <span className="ob-badge warn">Unverified</span>
            </>
          )}
        </dd>
      </div>
      <div>
        <dt>Niche {edit("niche", "Edit")}</dt>
        <dd>
          {state.profile?.niche_exploring
            ? "Still exploring"
            : primary
              ? (primary.custom_label ?? label(niches, primary.code))
              : none}
          {state.niches.filter((n) => n.role === "secondary").length > 0 &&
            ` · also ${state.niches
              .filter((n) => n.role === "secondary")
              .map((n) => n.custom_label ?? label(niches, n.code))
              .join(", ")}`}
        </dd>
      </div>
      <div>
        <dt>Goals {edit("goals", "Edit")}</dt>
        <dd>
          {state.goals.length
            ? state.goals
                .map((g) => label(goalCategories, g.category))
                .join(", ")
            : none}
        </dd>
      </div>
      <div>
        <dt>Challenges {edit("challenges", "Edit")}</dt>
        <dd>
          {state.challenges.length
            ? state.challenges.map((c) => label(challenges, c.code)).join(", ")
            : "Not shared"}
        </dd>
      </div>
      <div>
        <dt>Collaboration preferences {edit("preferences", "Edit")}</dt>
        <dd>
          {state.collaborations.some((c) => c.interested)
            ? state.collaborations
                .filter((c) => c.interested)
                .map((c) => label(collaborationCategories, c.category))
                .join(", ")
            : "Focusing on growth for now"}
          {state.industry_exclusions.length > 0 &&
            ` · Excluding ${state.industry_exclusions.map((x) => label(industries, x.industry)).join(", ")}`}
        </dd>
      </div>
      <div>
        <dt>Eligibility</dt>
        <dd>{e.standardInfluencer.text}</dd>
      </div>
      <div>
        <dt>Privacy</dt>
        <dd>
          <span className="ob-badge">Private</span> Your profile is private. It
          is not published or visible to Brands, and finishing onboarding does
          not change that.
        </dd>
      </div>
    </dl>
  );
}
export function EligibilityPanel({ state }: { state: CreatorState }) {
  const e = evaluateEligibility(state);
  const rows: [string, string][] = [
    ["Workspace", e.workspaceActivation.text],
    ["Growth tools", e.growthTools.text],
    ["Standard influencer collaborations", e.standardInfluencer.text],
    ["UGC", e.ugc.text],
    ["Account ownership", e.socialOwnership.text],
    ["Verification", e.commercialVerification.text],
    ["Specific campaigns", e.campaignSpecific.text],
  ];
  return (
    <dl className="ob-summary">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
