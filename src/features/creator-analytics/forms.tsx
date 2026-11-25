"use client";
import Link from "next/link";
import { useIdempotentForm } from "@/lib/use-idempotent-form";
import type { FormState } from "./actions";
import { templates } from "./experiments";
type Act = (prev: FormState, form: FormData) => Promise<FormState>;
function useIdem(action: Act) {
  const { state, pending, ref, onSubmit } = useIdempotentForm(action, null);
  return { state, pending, ref, onSubmit };
}
function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="st-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && (
        <p className="st-hint" id={`${id}-h`}>
          {hint}
        </p>
      )}
      {error && <p className="st-error">{error}</p>}
    </div>
  );
}
const Status = ({ s }: { s: FormState }) => (
  <p role="status" aria-live="polite" className={s?.ok ? "st-ok" : "st-error"}>
    {s?.message}
  </p>
);
export function AudienceForm({
  action,
  accounts,
  today,
}: {
  action: Act;
  accounts: { id: string; label: string }[];
  today: string;
}) {
  const { state, onSubmit, pending, ref } = useIdem(action);
  const e = state?.errors ?? {};
  return (
    <form
      onSubmit={onSubmit}
      ref={ref}
      noValidate
      aria-label="Record audience information"
    >
      <Field id="au-account" label="Account" error={e.account}>
        <select id="au-account" name="account">
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </Field>
      <Field id="au-dim" label="What the groups describe" error={e.dimension}>
        <select id="au-dim" name="dimension">
          <option value="geography">Country or region</option>
          <option value="language">Language</option>
          <option value="age_band">Age band</option>
          <option value="activity">Activity (for example by day)</option>
        </select>
      </Field>
      <fieldset>
        <legend>Groups and their share of the audience (percent)</legend>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} style={{ display: "flex", gap: "0.5rem" }}>
            <div className="st-field">
              <label htmlFor={`au-b${i}`}>Group {i}</label>
              <input id={`au-b${i}`} name={`b${i}`} maxLength={60} />
            </div>
            <div className="st-field">
              <label htmlFor={`au-s${i}`}>Percent {i}</label>
              <input
                id={`au-s${i}`}
                name={`s${i}`}
                type="number"
                min={0}
                max={100}
                step="any"
                inputMode="decimal"
              />
            </div>
          </div>
        ))}
        {(e.buckets || e.bucket || e.share) && (
          <p className="st-error">{e.buckets ?? e.bucket ?? e.share}</p>
        )}
        <p className="st-hint">
          Copy the percentages your platform shows. Leave unused rows empty.
          Percentages need not add up to 100 if you only copy the top groups.
        </p>
      </fieldset>
      <Field id="au-date" label="Observed on" error={e.observed_on}>
        <input
          id="au-date"
          name="observed_on"
          type="date"
          defaultValue={today}
          max={today}
          required
        />
      </Field>
      <Field id="au-dk" label="What the percentages are out of">
        <select id="au-dk" name="denominator_kind" defaultValue="unknown">
          <option value="unknown">I am not sure</option>
          <option value="followers">Followers</option>
          <option value="reached_audience">People reached</option>
          <option value="engaged_audience">People who engaged</option>
        </select>
      </Field>
      <Field
        id="au-den"
        label="Size of that group (optional)"
        error={e.denominator}
      >
        <input
          id="au-den"
          name="denominator"
          type="number"
          min={0}
          inputMode="numeric"
        />
      </Field>
      <Field
        id="au-cov"
        label="Share of the audience the platform covers, percent (optional)"
        error={e.coverage}
      >
        <input
          id="au-cov"
          name="coverage"
          type="number"
          min={0}
          max={100}
          step="any"
          inputMode="decimal"
        />
      </Field>
      <button className="st-btn primary" disabled={pending}>
        {pending ? "Saving…" : "Record audience information"}
      </button>
      <Status s={state} />
    </form>
  );
}
export function GrantForm({
  action,
  accounts,
}: {
  action: Act;
  accounts: { id: string; label: string }[];
}) {
  const { state, onSubmit, pending, ref } = useIdem(action);
  const e = state?.errors ?? {};
  return (
    <form
      onSubmit={onSubmit}
      ref={ref}
      noValidate
      aria-label="Share aggregate audience information with a Brand"
    >
      <Field id="gr-account" label="Account" error={e.account}>
        <select id="gr-account" name="account">
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </Field>
      <Field id="gr-rec" label="Brand workspace id" error={e.recipient}>
        <input id="gr-rec" name="recipient" required />
      </Field>
      <fieldset>
        <legend>What to share</legend>
        {[
          ["geography", "Country or region"],
          ["language", "Language"],
          ["age_band", "Age band"],
          ["activity", "Activity"],
        ].map(([v, l]) => (
          <label key={v} style={{ display: "block" }}>
            <input type="checkbox" name="dimensions" value={v} /> {l}
          </label>
        ))}
        {e.dimensions && <p className="st-error">{e.dimensions}</p>}
      </fieldset>
      <Field id="gr-p" label="Purpose" error={e.purpose}>
        <input id="gr-p" name="purpose" maxLength={200} required />
      </Field>
      <Field id="gr-d" label="Valid for (days, optional)" error={e.days}>
        <input id="gr-d" name="days" type="number" min={1} max={365} />
      </Field>
      <button className="st-btn" disabled={pending}>
        {pending ? "Sharing…" : "Share for this purpose"}
      </button>
      <Status s={state} />
    </form>
  );
}
export type Candidate = { id: string; label: string };
export function ExperimentForm({
  action,
  accounts,
  account,
  metric,
  candidates,
  defaults,
  insight,
}: {
  action: Act;
  accounts: { id: string; label: string }[];
  account: string;
  metric: string;
  candidates: Candidate[];
  insight?: string;
  defaults: Partial<(typeof templates)[number]>;
}) {
  const { state, onSubmit, pending } = useIdem(action);
  const e = state?.errors ?? {};
  return (
    <form onSubmit={onSubmit} noValidate aria-label="Create an experiment">
      <input type="hidden" name="template_key" value={defaults.key ?? ""} />
      <input type="hidden" name="source_insight" value={insight ?? ""} />
      <input type="hidden" name="account" value={account} />
      <input type="hidden" name="metric" value={metric} />
      <p className="st-hint">
        Account: {accounts.find((a) => a.id === account)?.label}. Metric:{" "}
        {metric.replace(/_/g, " ")}.{" "}
        <Link href="/creator/experiments/new">Change</Link>
      </p>
      <Field id="ex-name" label="Experiment name" error={e.name}>
        <input
          id="ex-name"
          name="name"
          defaultValue={defaults.name}
          maxLength={100}
          required
        />
      </Field>
      <Field
        id="ex-hyp"
        label="Your hypothesis"
        error={e.hypothesis}
        hint="Something you can check, phrased as a possibility."
      >
        <textarea
          id="ex-hyp"
          name="hypothesis"
          defaultValue={defaults.hypothesis}
          maxLength={500}
          required
          aria-describedby="ex-hyp-h"
        />
      </Field>
      <Field id="ex-obj" label="Objective" error={e.objective}>
        <input
          id="ex-obj"
          name="objective"
          defaultValue={defaults.objective}
          maxLength={300}
        />
      </Field>
      <Field id="ex-chg" label="Planned change" error={e.planned_change}>
        <textarea
          id="ex-chg"
          name="planned_change"
          defaultValue={defaults.planned_change}
          maxLength={500}
        />
      </Field>
      <Field
        id="ex-mm"
        label="How you will measure it"
        error={e.measurement_method}
      >
        <textarea
          id="ex-mm"
          name="measurement_method"
          defaultValue={defaults.measurement_method}
          maxLength={500}
        />
      </Field>
      <Field
        id="ex-sc"
        label="What would count as success"
        error={e.success_criterion}
      >
        <input
          id="ex-sc"
          name="success_criterion"
          defaultValue={defaults.success_criterion}
          maxLength={300}
        />
      </Field>
      <Field
        id="ex-cf"
        label="Things that could confuse the result"
        error={e.confounders}
      >
        <textarea
          id="ex-cf"
          name="confounders"
          defaultValue={defaults.confounders}
          maxLength={500}
        />
      </Field>
      <Field
        id="ex-days"
        label="Evaluation period (days)"
        error={e.evaluation_days}
      >
        <input
          id="ex-days"
          name="evaluation_days"
          type="number"
          min={3}
          max={180}
          defaultValue={defaults.evaluation_days ?? 28}
          required
        />
      </Field>
      <fieldset>
        <legend>Baseline: the recorded numbers to compare against</legend>
        {candidates.length === 0 ? (
          <p className="st-hint">
            No recorded observation of this metric exists for this account yet.
            You can still create the experiment, but it cannot start without a
            baseline or a stated reason.
          </p>
        ) : (
          candidates.map((c) => (
            <label key={c.id} style={{ display: "block" }}>
              <input type="checkbox" name="baseline_refs" value={c.id} />{" "}
              {c.label}
            </label>
          ))
        )}
        <Field
          id="ex-bu"
          label="If there is no baseline, why not?"
          error={e.baseline_unavailable_reason}
        >
          <input
            id="ex-bu"
            name="baseline_unavailable_reason"
            maxLength={300}
          />
        </Field>
        <p className="st-hint">
          The baseline you accept is frozen when you start the experiment. Later
          corrections will not change it.
        </p>
      </fieldset>
      <button className="st-btn primary" disabled={pending}>
        {pending ? "Saving…" : "Save as draft"}
      </button>
      <p className="st-hint">
        Saving does not start the experiment. You start it yourself.
      </p>
      <Status s={state} />
    </form>
  );
}
