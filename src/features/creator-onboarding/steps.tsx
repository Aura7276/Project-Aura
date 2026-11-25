"use client";
import { useState } from "react";
import type { ActionState } from "./actions";
import type { StepStatus } from "./types";
import {
  AreaField,
  CheckCard,
  OptionGroup,
  SelectField,
  TextField,
  type Option,
} from "./controls";
import { StepShell } from "./step-shell";
import {
  accountTypes,
  availabilityText,
  challenges,
  collaborationCategories,
  countries,
  currencies,
  equipment,
  goalCategories,
  industries,
  languages,
  metricLabels,
  niches,
  platforms,
  rateFormats,
  stages,
} from "./taxonomy";
import { screenshotUploadsEnabled, uploadDisabledReason } from "./evidence";
import { aiAvailability } from "./ai";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;
export type StepProps<T> = {
  revision: number;
  initial: T;
  action: Action;
  statuses: Partial<Record<string, StepStatus>>;
  backHref: string | null;
};
const opts = (
  list: readonly (readonly [string, string, ...unknown[]])[],
): Option[] => list.map(([value, label]) => ({ value, label }));
const currencyOptions: Option[] = currencies.map((c) => ({
  value: c,
  label: c,
}));
const patch =
  <T,>(set: (fn: (v: T) => T) => void) =>
  (p: Partial<T>) =>
    set((v) => ({ ...v, ...p }));

/* 1. Identity */
export type IdentityInit = {
  display_name: string;
  country: string;
  city: string;
  language: string;
  bio: string;
  stage: string;
};
export function IdentityStep({
  revision,
  initial,
  action,
  statuses,
  backHref,
}: StepProps<IdentityInit>) {
  const [v, setV] = useState(initial);
  const set = patch(setV);
  const ai = aiAvailability();
  return (
    <StepShell
      step="identity"
      revision={revision}
      title="Let’s start with you"
      intro="A few basics. We reuse what you already gave us, and you can change anything later."
      payload={v}
      action={action}
      statuses={statuses}
      backHref={backHref}
      notice={
        !ai.available && (
          <p className="ob-note" role="note">
            {ai.reason}
          </p>
        )
      }
    >
      {(e) => (
        <>
          <TextField
            label="Creator name"
            hint="The name you would like us to use. It does not have to be your legal name."
            value={v.display_name}
            onChange={(x) => set({ display_name: x })}
            error={e.display_name}
            maxLength={80}
            autoComplete="nickname"
          />
          <div className="ob-row two">
            <SelectField
              label="Country"
              value={v.country}
              onChange={(x) => set({ country: x })}
              options={opts(countries)}
              error={e.country}
            />
            <SelectField
              label="Preferred language"
              value={v.language}
              onChange={(x) => set({ language: x })}
              options={opts(languages)}
              error={e.language}
            />
          </div>
          <TextField
            label="City or region"
            optional
            hint="General location only. Please do not enter a street address."
            value={v.city}
            onChange={(x) => set({ city: x })}
            error={e.city}
            maxLength={80}
          />
          <OptionGroup
            name="stage"
            legend="Where are you on your creator journey?"
            hint="Pick what feels closest. This is about you, not a rating."
            selected={v.stage ? [v.stage] : []}
            onChange={([x]) => set({ stage: x })}
            options={stages.map(([value, label, hint]) => ({
              value,
              label,
              hint,
            }))}
            error={e.stage}
          />
          <AreaField
            label="Short introduction"
            optional
            hint="One or two lines about what you make. This stays private."
            value={v.bio}
            onChange={(x) => set({ bio: x })}
            maxLength={280}
            error={e.bio}
          />
        </>
      )}
    </StepShell>
  );
}

/* 2. Social accounts */
export type AccountInit = {
  platform: string;
  handle: string;
  profile_url: string;
  account_type: string;
  ownership_scope: "individual" | "brand_or_company";
  visibility: string;
  self_reported_followers: string;
  observed_on: string;
  is_primary: boolean;
};
export type SocialInit = { none: boolean; accounts: AccountInit[] };
const blankAccount = (): AccountInit => ({
  platform: "instagram",
  handle: "",
  profile_url: "",
  account_type: "",
  ownership_scope: "individual",
  visibility: "unknown",
  self_reported_followers: "",
  observed_on: "",
  is_primary: false,
});
export function SocialStep({
  revision,
  initial,
  action,
  statuses,
  backHref,
}: StepProps<SocialInit>) {
  const [v, setV] = useState(initial);
  const update = (i: number, p: Partial<AccountInit>) =>
    setV((s) => ({
      ...s,
      accounts: s.accounts.map((a, j) =>
        j === i
          ? { ...a, ...p }
          : p.is_primary
            ? { ...a, is_primary: false }
            : a,
      ),
    }));
  return (
    <StepShell
      step="social"
      revision={revision}
      title="Your social accounts"
      intro="Add accounts if you have them. You do not need any to use AURA."
      optional
      payload={v}
      action={action}
      statuses={statuses}
      backHref={backHref}
    >
      {(e) => (
        <>
          <p className="ob-note" role="note">
            Everything here is self-reported and unverified. We never ask for
            passwords, and we do not look up your accounts.
          </p>
          <CheckCard
            label="I don’t have a social account yet"
            hint="That is completely fine. Your growth plan will start from scratch."
            checked={v.none}
            onChange={(none) =>
              setV({ none, accounts: none ? [] : v.accounts })
            }
          />
          {!v.none && (
            <>
              {v.accounts.map((a, i) => {
                const k = (f: string) => e[`accounts.${i}.${f}`];
                return (
                  <section
                    className="ob-account"
                    key={i}
                    aria-label={`Account ${i + 1}`}
                  >
                    <h2>Account {i + 1}</h2>
                    <div className="ob-row two">
                      <SelectField
                        label="Platform"
                        value={a.platform}
                        onChange={(x) =>
                          update(i, {
                            platform: x,
                            account_type:
                              x === "instagram" ? a.account_type : "",
                          })
                        }
                        options={opts(platforms)}
                        error={k("platform")}
                      />
                      <TextField
                        label="Username"
                        hint="Without the @"
                        value={a.handle}
                        onChange={(x) => update(i, { handle: x })}
                        error={k("handle")}
                        maxLength={61}
                        autoComplete="off"
                      />
                    </div>
                    <TextField
                      label="Profile link"
                      optional
                      hint="Starts with https://. We never open it for you."
                      value={a.profile_url}
                      onChange={(x) => update(i, { profile_url: x })}
                      error={k("profile_url")}
                      inputMode="url"
                    />
                    {a.platform === "instagram" && (
                      <SelectField
                        label="Instagram account type"
                        optional
                        hint="Personal, Creator and Business accounts are all welcome."
                        value={a.account_type}
                        onChange={(x) => update(i, { account_type: x })}
                        options={opts(accountTypes)}
                        error={k("account_type")}
                      />
                    )}
                    <div className="ob-row two">
                      <SelectField
                        label="Who can see it"
                        value={a.visibility}
                        onChange={(x) => update(i, { visibility: x })}
                        options={[
                          { value: "public", label: "Public" },
                          { value: "private", label: "Private" },
                          { value: "unknown", label: "Not sure" },
                        ]}
                      />
                      <TextField
                        label="Followers"
                        optional
                        hint="Your best estimate. Leave blank if unknown."
                        value={a.self_reported_followers}
                        onChange={(x) =>
                          update(i, {
                            self_reported_followers: x.replace(/[^\d]/g, ""),
                          })
                        }
                        inputMode="numeric"
                        error={k("self_reported_followers")}
                      />
                    </div>
                    {a.self_reported_followers && (
                      <TextField
                        label="Date of that count"
                        type="date"
                        hint="Defaults to today."
                        value={a.observed_on}
                        onChange={(x) => update(i, { observed_on: x })}
                        error={k("observed_on")}
                      />
                    )}
                    <CheckCard
                      label="This is a Brand or company page, not my own account"
                      checked={a.ownership_scope === "brand_or_company"}
                      onChange={(c) =>
                        update(i, {
                          ownership_scope: c
                            ? "brand_or_company"
                            : "individual",
                        })
                      }
                    />
                    <CheckCard
                      label="This is my main account"
                      checked={a.is_primary}
                      onChange={(c) => update(i, { is_primary: c })}
                    />
                    <div className="ob-actions">
                      <button
                        type="button"
                        className="ob-btn quiet"
                        onClick={() =>
                          setV((s) => ({
                            ...s,
                            accounts: s.accounts.filter((_, j) => j !== i),
                          }))
                        }
                      >
                        Remove account {i + 1}
                      </button>
                    </div>
                  </section>
                );
              })}
              {e.accounts && (
                <p className="ob-error" role="alert">
                  {e.accounts}
                </p>
              )}
              <div className="ob-actions">
                <button
                  type="button"
                  className="ob-btn quiet"
                  disabled={v.accounts.length >= 10}
                  onClick={() =>
                    setV((s) => ({
                      ...s,
                      accounts: [...s.accounts, blankAccount()],
                    }))
                  }
                >
                  Add an account
                </button>
                <span className="ob-hint">{v.accounts.length} of 10</span>
              </div>
              <div className="ob-box">
                <h3>Screenshot (optional)</h3>
                {screenshotUploadsEnabled ? null : (
                  <p className="ob-hint">{uploadDisabledReason}</p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </StepShell>
  );
}

/* 3. Niche */
export type NicheInit = {
  exploring: boolean;
  primary: string;
  primaryCustom: string;
  secondary: string[];
  interests: string[];
  customInterest: string;
};
export function NicheStep({
  revision,
  initial,
  action,
  statuses,
  backHref,
}: StepProps<NicheInit>) {
  const [v, setV] = useState(initial);
  const set = patch(setV);
  const needsLabel = v.primary === "other";
  const payload = {
    exploring: v.exploring,
    primary:
      v.exploring || !v.primary
        ? null
        : {
            code: v.primary,
            custom_label: needsLabel ? v.primaryCustom : undefined,
          },
    secondary: v.secondary
      .filter((s) => s !== v.primary)
      .map((code) => ({
        code,
        custom_label: code === "other" ? "Other" : undefined,
      })),
    interests: [
      ...v.interests
        .filter((s) => s !== v.primary)
        .map((code) => ({
          code,
          custom_label: code === "other" ? "Other" : undefined,
        })),
      ...(v.customInterest.trim()
        ? [{ code: "custom", custom_label: v.customInterest.trim() }]
        : []),
    ],
  };
  return (
    <StepShell
      step="niche"
      revision={revision}
      title="What do you make?"
      intro="Choose one main niche, and any others that fit. Not sure yet? That is a valid answer."
      payload={payload}
      action={action}
      statuses={statuses}
      backHref={backHref}
    >
      {(e) => (
        <>
          <CheckCard
            label="I’m still exploring my niche"
            hint="We will help you work it out in your growth plan."
            checked={v.exploring}
            onChange={(exploring) => set({ exploring })}
          />
          {!v.exploring && (
            <>
              <OptionGroup
                name="primary"
                legend="Primary niche"
                hint="The one area you would say you are known for, or want to be."
                searchable
                cols={2}
                selected={v.primary ? [v.primary] : []}
                onChange={([x]) => set({ primary: x })}
                options={opts(niches)}
                error={e.primary}
              />
              {needsLabel && (
                <TextField
                  label="Describe your niche"
                  value={v.primaryCustom}
                  onChange={(x) => set({ primaryCustom: x })}
                  maxLength={60}
                  error={e["primary.custom_label"]}
                />
              )}
            </>
          )}
          <OptionGroup
            name="secondary"
            legend="Other niches"
            hint="Optional."
            multiple
            max={5}
            cols={2}
            selected={v.secondary}
            onChange={(secondary) => set({ secondary })}
            options={opts(niches.filter(([c]) => c !== v.primary))}
            error={e.secondary}
          />
          <OptionGroup
            name="interests"
            legend="Creative interests"
            hint="Optional. Things you enjoy making, such as reels, storytelling or editing."
            multiple
            max={8}
            cols={2}
            selected={v.interests}
            onChange={(interests) => set({ interests })}
            options={opts(niches.filter(([c]) => c !== v.primary))}
            error={e.interests}
          />
          <TextField
            label="Add your own interest"
            optional
            value={v.customInterest}
            onChange={(x) => set({ customInterest: x })}
            maxLength={60}
          />
        </>
      )}
    </StepShell>
  );
}

/* 4. Goals */
export type GoalDraft = {
  metric: string;
  baseline: string;
  target: string;
  timeframe_days: string;
  currency: string;
};
export type GoalsInit = {
  selected: string[];
  details: Record<string, GoalDraft>;
};
const blankGoal = (): GoalDraft => ({
  metric: "",
  baseline: "",
  target: "",
  timeframe_days: "",
  currency: "INR",
});
export function GoalsStep({
  revision,
  initial,
  action,
  statuses,
  backHref,
}: StepProps<GoalsInit>) {
  const [v, setV] = useState(initial);
  const payload = {
    goals: v.selected.map((category) => ({
      category,
      ...(v.details[category] ?? blankGoal()),
    })),
  };
  const setDetail = (c: string, p: Partial<GoalDraft>) =>
    setV((s) => ({
      ...s,
      details: {
        ...s.details,
        [c]: { ...(s.details[c] ?? blankGoal()), ...p },
      },
    }));
  return (
    <StepShell
      step="goals"
      revision={revision}
      title="What would you like to grow?"
      intro="Choose one or more goals. Numbers are optional, and you can set them later."
      payload={payload}
      action={action}
      statuses={statuses}
      backHref={backHref}
    >
      {(e) => (
        <>
          <OptionGroup
            name="goals"
            legend="Your goals"
            hint="These stay private to you."
            multiple
            cols={2}
            selected={v.selected}
            onChange={(selected) => setV((s) => ({ ...s, selected }))}
            options={goalCategories.map(([value, label]) => ({ value, label }))}
            error={e["goals"] ?? e["goals.0.category"]}
          />
          {v.selected.map((c, i) => {
            const def = goalCategories.find(([k]) => k === c);
            const d = v.details[c] ?? blankGoal();
            const metricOptions = Object.entries(metricLabels).map(
              ([value, label]) => ({ value, label }),
            );
            const metric = d.metric || (def?.[2] ?? "");
            return (
              <details className="ob-box" key={c}>
                <summary>{def?.[1]}: add a target (optional)</summary>
                <p className="ob-hint">
                  Skip this if you are not sure. Please do not guess a starting
                  number. Leave it blank and it stays unknown.
                </p>
                <SelectField
                  label="What to measure"
                  optional
                  value={metric}
                  onChange={(x) => setDetail(c, { metric: x })}
                  options={metricOptions}
                  error={e[`goals.${i}.metric`]}
                />
                <div className="ob-row two">
                  <TextField
                    label="Where you are now"
                    optional
                    hint="Your own estimate."
                    type="number"
                    inputMode="decimal"
                    value={d.baseline}
                    onChange={(x) => setDetail(c, { baseline: x })}
                    error={e[`goals.${i}.baseline`]}
                  />
                  <TextField
                    label="Your target"
                    optional
                    type="number"
                    inputMode="decimal"
                    value={d.target}
                    onChange={(x) => setDetail(c, { target: x })}
                    error={e[`goals.${i}.target`]}
                  />
                </div>
                {metric === "monthly_income" && (
                  <SelectField
                    label="Currency"
                    value={d.currency}
                    onChange={(x) => setDetail(c, { currency: x })}
                    options={currencyOptions}
                    error={e[`goals.${i}.currency`]}
                  />
                )}
                <TextField
                  label="Days to reach it"
                  optional
                  hint="For example 30, 90 or 180."
                  type="number"
                  inputMode="numeric"
                  value={d.timeframe_days}
                  onChange={(x) => setDetail(c, { timeframe_days: x })}
                  error={e[`goals.${i}.timeframe_days`]}
                />
                <p className="ob-hint">
                  A target is something to aim for. It is not a promise of
                  results.
                </p>
              </details>
            );
          })}
        </>
      )}
    </StepShell>
  );
}

/* 5. Challenges */
export type ChallengesInit = {
  selected: string[];
  details: Record<string, string>;
};
export function ChallengesStep({
  revision,
  initial,
  action,
  statuses,
  backHref,
}: StepProps<ChallengesInit>) {
  const [v, setV] = useState(initial);
  const payload = {
    challenges: v.selected.map((code) => ({
      code,
      detail: v.details[code] ?? "",
    })),
  };
  return (
    <StepShell
      step="challenges"
      revision={revision}
      title="What’s hardest right now?"
      intro="This helps us suggest useful next steps. Only you can see your answers."
      optional
      payload={payload}
      action={action}
      statuses={statuses}
      backHref={backHref}
    >
      {(e) => (
        <>
          <OptionGroup
            name="challenges"
            legend="Pick any that apply"
            multiple
            searchable
            cols={2}
            selected={v.selected}
            onChange={(selected) => setV((s) => ({ ...s, selected }))}
            options={opts(challenges)}
            error={e.challenges}
          />
          {v.selected.length > 0 && (
            <AreaField
              label="Anything you would like to add"
              optional
              hint="Please do not include personal or financial details."
              maxLength={300}
              value={v.details[v.selected[0]] ?? ""}
              onChange={(x) =>
                setV((s) => ({
                  ...s,
                  details: { ...s.details, [s.selected[0]]: x },
                }))
              }
            />
          )}
        </>
      )}
    </StepShell>
  );
}

/* 6. Collaboration preferences, industries and exclusions */
export type PreferencesInit = {
  collaborations: string[];
  prior_collaboration: string;
  preferred: string[];
  considering: string[];
  exclusions: string[];
  restrictions: string;
};
export function PreferencesStep({
  revision,
  initial,
  action,
  statuses,
  backHref,
}: StepProps<PreferencesInit>) {
  const [v, setV] = useState(initial);
  const set = patch(setV);
  const payload = {
    ...v,
    exclusions: v.exclusions.map((industry) => ({ industry })),
  };
  const allowed = (own: string[]) =>
    industries.filter(([c]) => own.includes(c) || !v.exclusions.includes(c));
  return (
    <StepShell
      step="preferences"
      revision={revision}
      title="How would you like to work with Brands?"
      intro="Optional. You can focus only on growth and come back when you are ready."
      optional
      payload={payload}
      action={action}
      statuses={statuses}
      backHref={backHref}
    >
      {(e) => (
        <>
          <OptionGroup
            name="collab"
            legend="Collaboration types you are interested in"
            hint="Choosing one does not guarantee access. Availability follows our release plan."
            multiple
            cols={1}
            selected={v.collaborations}
            onChange={(collaborations) => set({ collaborations })}
            options={collaborationCategories.map(([value, label, a]) => ({
              value,
              label,
              hint: availabilityText[a],
            }))}
            error={e.collaborations}
          />
          <OptionGroup
            name="prior"
            legend="Have you worked with a Brand before?"
            hint="No experience is needed."
            selected={v.prior_collaboration ? [v.prior_collaboration] : []}
            onChange={([x]) => set({ prior_collaboration: x })}
            options={[
              { value: "none", label: "Not yet" },
              { value: "some", label: "A few times" },
              { value: "regular", label: "Regularly" },
            ]}
          />
          <OptionGroup
            name="excl"
            legend="Industries you will not work with"
            hint="These always come first. We will never suggest them."
            multiple
            searchable
            cols={2}
            selected={v.exclusions}
            onChange={(exclusions) =>
              setV((s) => ({
                ...s,
                exclusions,
                preferred: s.preferred.filter((p) => !exclusions.includes(p)),
                considering: s.considering.filter(
                  (p) => !exclusions.includes(p),
                ),
              }))
            }
            options={opts(industries)}
            error={e.exclusions}
          />
          <OptionGroup
            name="pref"
            legend="Industries you would love to work with"
            multiple
            searchable
            cols={2}
            selected={v.preferred}
            onChange={(preferred) =>
              set({
                preferred,
                considering: v.considering.filter(
                  (c) => !preferred.includes(c),
                ),
              })
            }
            options={opts(allowed(v.preferred))}
          />
          <OptionGroup
            name="cons"
            legend="Industries you would consider"
            multiple
            searchable
            cols={2}
            selected={v.considering}
            onChange={(considering) => set({ considering })}
            options={opts(
              allowed(v.considering).filter(([c]) => !v.preferred.includes(c)),
            )}
          />
          <AreaField
            label="Anything else we should respect"
            optional
            hint="For example, topics or content you will not create."
            value={v.restrictions}
            onChange={(x) => set({ restrictions: x })}
            maxLength={300}
            error={e.restrictions}
          />
        </>
      )}
    </StepShell>
  );
}

/* 7. Rates (after activation) */
export type RateDraft = {
  format: string;
  enabled: boolean;
  amount: string;
  currency: string;
  negotiable: boolean;
  unsure: boolean;
};
export type RatesInit = { rows: RateDraft[] };
export function RatesStep({
  revision,
  initial,
  action,
  statuses,
  backHref,
}: StepProps<RatesInit>) {
  const [v, setV] = useState(initial);
  const upd = (i: number, p: Partial<RateDraft>) =>
    setV((s) => ({
      rows: s.rows.map((r, j) => (j === i ? { ...r, ...p } : r)),
    }));
  const payload = {
    rates: v.rows
      .filter((r) => r.enabled)
      .map(({ format, amount, currency, negotiable, unsure }) => ({
        format,
        amount,
        currency,
        negotiable,
        unsure,
      })),
  };
  return (
    <StepShell
      step="rates"
      revision={revision}
      title="Your rates"
      intro="Optional and private. Add only what you want to. Not sure what to charge? Mark it as unsure."
      optional
      payload={payload}
      action={action}
      statuses={statuses}
      backHref={backHref}
    >
      {(e) => (
        <>
          <p className="ob-note" role="note">
            These are your own numbers. We do not suggest or guarantee market
            rates.
          </p>
          {v.rows.map((r, i) => {
            const label = rateFormats.find(([c]) => c === r.format)![1];
            return (
              <section className="ob-account" key={r.format} aria-label={label}>
                <CheckCard
                  label={label}
                  checked={r.enabled}
                  onChange={(enabled) => upd(i, { enabled })}
                />
                {r.enabled && (
                  <>
                    <CheckCard
                      label="I’m not sure what to charge"
                      checked={r.unsure}
                      onChange={(unsure) =>
                        upd(i, { unsure, amount: unsure ? "" : r.amount })
                      }
                    />
                    {!r.unsure && (
                      <div className="ob-row two">
                        <TextField
                          label={`Rate for ${label.toLowerCase()}`}
                          optional
                          type="text"
                          inputMode="decimal"
                          value={r.amount}
                          onChange={(x) => upd(i, { amount: x })}
                          error={e[`rates.${i}.amount`]}
                        />
                        <SelectField
                          label="Currency"
                          value={r.currency}
                          onChange={(x) => upd(i, { currency: x })}
                          options={currencyOptions}
                        />
                      </div>
                    )}
                    <CheckCard
                      label="Open to negotiation"
                      checked={r.negotiable}
                      onChange={(negotiable) => upd(i, { negotiable })}
                    />
                  </>
                )}
              </section>
            );
          })}
        </>
      )}
    </StepShell>
  );
}

/* 8. Resources (after activation) */
export type ResourcesInit = {
  hours_per_week: string;
  posts_per_week: string;
  equipment: string[];
  budget: string;
  budget_currency: string;
};
export function ResourcesStep({
  revision,
  initial,
  action,
  statuses,
  backHref,
}: StepProps<ResourcesInit>) {
  const [v, setV] = useState(initial);
  const set = patch(setV);
  return (
    <StepShell
      step="resources"
      revision={revision}
      title="Your time and tools"
      intro="Optional. You do not need any equipment or budget, and we will keep suggestions realistic for what you have."
      optional
      payload={v}
      action={action}
      statuses={statuses}
      backHref={backHref}
    >
      {(e) => (
        <>
          <div className="ob-row two">
            <TextField
              label="Hours a week for content"
              optional
              type="number"
              inputMode="decimal"
              value={v.hours_per_week}
              onChange={(x) => set({ hours_per_week: x })}
              error={e.hours_per_week}
            />
            <TextField
              label="Posts a week you could manage"
              optional
              type="number"
              inputMode="numeric"
              value={v.posts_per_week}
              onChange={(x) => set({ posts_per_week: x })}
              error={e.posts_per_week}
            />
          </div>
          <OptionGroup
            name="equip"
            legend="What do you have to work with?"
            hint="Tick whatever applies. A smartphone is plenty."
            multiple
            cols={2}
            selected={v.equipment}
            onChange={(equipment) => set({ equipment })}
            options={opts(equipment)}
            error={e.equipment}
          />
          <div className="ob-row two">
            <TextField
              label="Monthly content budget"
              optional
              hint="Zero is fine. No bank details needed."
              inputMode="decimal"
              value={v.budget}
              onChange={(x) => set({ budget: x })}
              error={e.budget}
            />
            <SelectField
              label="Currency"
              value={v.budget_currency}
              onChange={(x) => set({ budget_currency: x })}
              options={currencyOptions}
            />
          </div>
        </>
      )}
    </StepShell>
  );
}
