"use client";
import { useIdempotentForm } from "@/lib/use-idempotent-form";
import type { FormState } from "./actions";
import { reportReasons } from "./rules";
type Act = (prev: FormState, form: FormData) => Promise<FormState>;
export function ReportForm({ action, id }: { action: Act; id: string }) {
  const { state, onSubmit, pending } = useIdempotentForm(action);
  const s = state as FormState;
  return (
    <form onSubmit={onSubmit} aria-label="Report this campaign">
      <input type="hidden" name="id" value={id} />
      <fieldset>
        <legend>What is wrong?</legend>
        {Object.entries(reportReasons).map(([k, l]) => (
          <label key={k} style={{ display: "block" }}>
            <input type="radio" name="reason" value={k} required /> {l}
          </label>
        ))}
        {s?.errors?.reason && <p className="st-error">{s.errors.reason}</p>}
      </fieldset>
      <div className="st-field">
        <label htmlFor="rp-d">Details (optional)</label>
        <textarea id="rp-d" name="details" maxLength={1000} rows={3} />
      </div>
      <button className="st-btn" disabled={pending}>
        {pending ? "Sending…" : "Send report"}
      </button>
      <p
        role="status"
        aria-live="polite"
        className={s?.ok ? "st-ok" : "st-error"}
      >
        {s?.message}
      </p>
    </form>
  );
}
