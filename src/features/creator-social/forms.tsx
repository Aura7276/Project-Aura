"use client";
import { useActionState, useRef } from "react";
import type { FormState } from "./actions";
import { platforms } from "./catalogue";
import { metrics } from "./metrics";

type Act = (prev: FormState, form: FormData) => Promise<FormState>;
function useIdem(action: Act) {
  const key = useRef<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  const wrapped = async (
    prev: FormState,
    form: FormData,
  ): Promise<FormState> => {
    key.current ??= crypto.randomUUID();
    form.set("request", key.current);
    const r = await action(prev, form);
    if (r?.ok) {
      key.current = null;
      ref.current?.reset();
    }
    return r;
  };
  const [state, run, pending] = useActionState<FormState, FormData>(
    wrapped,
    null,
  );
  return { state, run, pending, ref };
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
      {error && (
        <p className="st-error" id={`${id}-e`}>
          {error}
        </p>
      )}
    </div>
  );
}
function Status({ s }: { s: FormState }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={s?.ok ? "st-ok" : "st-error"}
    >
      {s?.message}
    </p>
  );
}
export function AddAccountForm({
  action,
  today,
  atLimit,
}: {
  action: Act;
  today: string;
  atLimit: boolean;
}) {
  const { state, run, pending, ref } = useIdem(action);
  const e = state?.errors ?? {};
  return (
    <form action={run} ref={ref} noValidate aria-label="Add a social account">
      <Field id="a-platform" label="Platform" error={e.platform}>
        <select
          id="a-platform"
          name="platform"
          defaultValue="instagram"
          aria-invalid={e.platform ? true : undefined}
        >
          {platforms.map((p) => (
            <option key={p.code} value={p.code}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>
      <Field
        id="a-handle"
        label="Handle"
        error={e.handle}
        hint="Without the @. Each platform has its own rules."
      >
        <input
          id="a-handle"
          name="handle"
          required
          maxLength={100}
          autoComplete="off"
          aria-invalid={e.handle ? true : undefined}
          aria-describedby="a-handle-h"
        />
      </Field>
      <Field id="a-url" label="Profile link (optional)" error={e.profile_url}>
        <input
          id="a-url"
          name="profile_url"
          type="url"
          maxLength={300}
          aria-invalid={e.profile_url ? true : undefined}
        />
      </Field>
      <Field id="a-name" label="Display name (optional)" error={e.display_name}>
        <input id="a-name" name="display_name" maxLength={80} />
      </Field>
      <Field id="a-vis" label="Is the account public?">
        <select id="a-vis" name="visibility" defaultValue="unknown">
          <option value="unknown">I am not sure</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
      </Field>
      <Field
        id="a-cat"
        label="Content category (optional)"
        error={e.content_category}
      >
        <input id="a-cat" name="content_category" maxLength={60} />
      </Field>
      <Field
        id="a-fol"
        label="Followers right now (optional)"
        error={e.followers}
        hint="Zero is a real answer. Leave blank if you do not know. This is self-reported."
      >
        <input
          id="a-fol"
          name="followers"
          type="number"
          inputMode="numeric"
          min={0}
          aria-describedby="a-fol-h"
          aria-invalid={e.followers ? true : undefined}
        />
      </Field>
      <Field id="a-date" label="Date of that number" error={e.observed_on}>
        <input
          id="a-date"
          name="observed_on"
          type="date"
          defaultValue={today}
          max={today}
        />
      </Field>
      <p>
        <label>
          <input type="checkbox" name="brand_page" /> This is a brand or company
          page, not my personal account
        </label>
      </p>
      <p>
        <label>
          <input type="checkbox" name="is_primary" /> Make this my primary
          account
        </label>
      </p>
      <p>
        <label>
          <input type="checkbox" name="preferred" /> Preferred account for this
          platform
        </label>
      </p>
      <button
        className="st-btn primary"
        disabled={pending || atLimit}
        aria-busy={pending}
      >
        {pending ? "Adding…" : "Add account"}
      </button>
      {atLimit && (
        <p className="st-hint">You have reached the account limit.</p>
      )}
      <Status s={state} />
    </form>
  );
}
export function UpdateAccountForm({
  action,
  account,
}: {
  action: Act;
  account: {
    id: string;
    display_name: string | null;
    content_category: string | null;
    profile_url: string | null;
  };
}) {
  const [state, run, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );
  const e = state?.errors ?? {};
  return (
    <form action={run} noValidate aria-label="Edit account details">
      <input type="hidden" name="account" value={account.id} />
      <Field id="u-name" label="Display name" error={e.display_name}>
        <input
          id="u-name"
          name="display_name"
          defaultValue={account.display_name ?? ""}
          maxLength={80}
        />
      </Field>
      <Field id="u-cat" label="Content category" error={e.content_category}>
        <input
          id="u-cat"
          name="content_category"
          defaultValue={account.content_category ?? ""}
          maxLength={60}
        />
      </Field>
      <Field id="u-url" label="Profile link" error={e.profile_url}>
        <input
          id="u-url"
          name="profile_url"
          type="url"
          defaultValue={account.profile_url ?? ""}
          maxLength={300}
        />
      </Field>
      <button className="st-btn" disabled={pending}>
        {pending ? "Saving…" : "Save details"}
      </button>
      <Status s={state} />
    </form>
  );
}
export function ObservationForm({
  action,
  account,
  platform,
  today,
}: {
  action: Act;
  account: string;
  platform: string;
  today: string;
}) {
  const { state, run, pending, ref } = useIdem(action);
  const e = state?.errors ?? {};
  const list = metrics.filter(
    (m) => m.scope === "account" && m.platforms.includes(platform),
  );
  return (
    <form action={run} ref={ref} noValidate aria-label="Record a metric">
      <input type="hidden" name="account" value={account} />
      <Field id="o-metric" label="Metric" error={e.metric}>
        <select id="o-metric" name="metric" defaultValue={list[0]?.code}>
          {list.map((m) => (
            <option key={m.code} value={m.code}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>
      <Field
        id="o-value"
        label="Value"
        error={e.value}
        hint="Zero is a real answer. Leave this alone if you do not know."
      >
        <input
          id="o-value"
          name="value"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          required
          aria-describedby="o-value-h"
          aria-invalid={e.value ? true : undefined}
        />
      </Field>
      <Field id="o-date" label="Observed on" error={e.observed_on}>
        <input
          id="o-date"
          name="observed_on"
          type="date"
          defaultValue={today}
          max={today}
          required
        />
      </Field>
      <Field
        id="o-ps"
        label="Period start (for period totals)"
        error={e.period_start}
      >
        <input id="o-ps" name="period_start" type="date" max={today} />
      </Field>
      <Field id="o-pe" label="Period end" error={e.period_end}>
        <input id="o-pe" name="period_end" type="date" max={today} />
      </Field>
      <Field id="o-note" label="Note (optional)" error={e.note}>
        <input id="o-note" name="note" maxLength={200} />
      </Field>
      <button className="st-btn primary" disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : "Record metric"}
      </button>
      <Status s={state} />
    </form>
  );
}
export function ContentForm({
  action,
  account,
  platform,
  today,
}: {
  action: Act;
  account: string;
  platform: string;
  today: string;
}) {
  const { state, run, pending, ref } = useIdem(action);
  const e = state?.errors ?? {};
  const list = metrics.filter(
    (m) => m.scope === "content" && m.platforms.includes(platform),
  );
  return (
    <form
      action={run}
      ref={ref}
      noValidate
      aria-label="Record a content metric"
    >
      <input type="hidden" name="account" value={account} />
      <Field id="c-url" label="Content link" error={e.url}>
        <input id="c-url" name="url" type="url" maxLength={300} />
      </Field>
      <Field id="c-id" label="Or an id you choose" error={e.external_id}>
        <input id="c-id" name="external_id" maxLength={100} />
      </Field>
      <Field id="c-title" label="Title (optional)" error={e.title}>
        <input id="c-title" name="title" maxLength={120} />
      </Field>
      <Field id="c-metric" label="Metric" error={e.metric}>
        <select id="c-metric" name="metric" defaultValue={list[0]?.code}>
          {list.map((m) => (
            <option key={m.code} value={m.code}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>
      <Field id="c-window" label="Counted over" error={e.window}>
        <select id="c-window" name="window" defaultValue="lifetime">
          <option value="lifetime">Lifetime so far</option>
          <option value="window">A period</option>
        </select>
      </Field>
      <Field id="c-value" label="Value" error={e.value}>
        <input
          id="c-value"
          name="value"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          required
        />
      </Field>
      <Field id="c-date" label="Observed on" error={e.observed_on}>
        <input
          id="c-date"
          name="observed_on"
          type="date"
          defaultValue={today}
          max={today}
          required
        />
      </Field>
      <Field
        id="c-ps"
        label="Period start (period only)"
        error={e.period_start}
      >
        <input id="c-ps" name="period_start" type="date" max={today} />
      </Field>
      <Field id="c-pe" label="Period end" error={e.period_end}>
        <input id="c-pe" name="period_end" type="date" max={today} />
      </Field>
      <button className="st-btn primary" disabled={pending}>
        {pending ? "Saving…" : "Record for this content"}
      </button>
      <Status s={state} />
    </form>
  );
}
export function EvidenceForm({
  action,
  claim,
  enabled,
  reason,
}: {
  action: Act;
  claim: string;
  enabled: boolean;
  reason: string;
}) {
  const [state, run, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );
  if (!enabled) return <p className="st-hint">{reason}</p>;
  return (
    <form action={run} aria-label="Upload verification evidence">
      <input type="hidden" name="claim" value={claim} />
      <Field id="e-file" label="Screenshot (PNG, JPEG or WebP)">
        <input
          id="e-file"
          name="file"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required
        />
      </Field>
      <button className="st-btn" disabled={pending}>
        {pending ? "Uploading…" : "Upload privately"}
      </button>
      <Status s={state} />
    </form>
  );
}
const shareFields = [
  "followers",
  "following",
  "posts_total",
  "reach",
  "impressions",
  "profile_views",
  "interactions",
  "audience_growth",
];
export function GrantForm({
  action,
  account,
}: {
  action: Act;
  account: string;
}) {
  const { state, run, pending, ref } = useIdem(action);
  const e = state?.errors ?? {};
  return (
    <form
      action={run}
      ref={ref}
      noValidate
      aria-label="Share with a Brand or Agency workspace"
    >
      <input type="hidden" name="account" value={account} />
      <Field id="g-rec" label="Recipient workspace id" error={e.recipient}>
        <input id="g-rec" name="recipient" required />
      </Field>
      <fieldset>
        <legend>Fields to share</legend>
        {shareFields.map((f) => (
          <label key={f} style={{ display: "block" }}>
            <input type="checkbox" name="fields" value={f} />{" "}
            {f.replace(/_/g, " ")}
          </label>
        ))}
        {e.fields && <p className="st-error">{e.fields}</p>}
      </fieldset>
      <Field id="g-purpose" label="Purpose" error={e.purpose}>
        <input id="g-purpose" name="purpose" maxLength={200} required />
      </Field>
      <Field
        id="g-days"
        label="Valid for (days, optional)"
        error={e.valid_days}
      >
        <input id="g-days" name="valid_days" type="number" min={1} max={365} />
      </Field>
      <button className="st-btn" disabled={pending}>
        {pending ? "Sharing…" : "Share"}
      </button>
      <Status s={state} />
    </form>
  );
}
