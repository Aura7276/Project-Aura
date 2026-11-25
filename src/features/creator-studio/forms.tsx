"use client";
import Link from "next/link";
import { useActionState, useRef } from "react";
import type { FormState } from "./actions";

type Act = (prev: FormState, form: FormData) => Promise<FormState>;
/**
 * One idempotency key per logical submission: created on first submit, reused on retry (so a double-click or a retry after a
 * network error cannot create a duplicate) and discarded after success. No effect and no hydration mismatch.
 */
function useIdempotent(action: Act | undefined) {
  const key = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const wrapped = async (
    prev: FormState,
    form: FormData,
  ): Promise<FormState> => {
    if (!action) return null;
    key.current ??= crypto.randomUUID();
    form.set("request", key.current);
    const result = await action(prev, form);
    if (result?.ok) {
      key.current = null;
      formRef.current?.reset();
    }
    return result;
  };
  const [state, run, pending] = useActionState<FormState, FormData>(
    wrapped,
    null,
  );
  return { state, run, pending, formRef };
}
export function IdeaForm({
  action,
  live = true,
  idPrefix = "idea",
}: {
  action?: Act;
  live?: boolean;
  idPrefix?: string;
}) {
  const { state, run, pending, formRef } = useIdempotent(action);
  const e = state?.errors ?? {};
  return (
    <form action={run} ref={formRef} noValidate aria-label="Capture an idea">
      <div className="st-field">
        <label htmlFor={`${idPrefix}-t`}>Idea</label>
        <input
          id={`${idPrefix}-t`}
          name="title"
          maxLength={120}
          required
          aria-invalid={e.title ? true : undefined}
          aria-describedby={e.title ? `${idPrefix}-te` : undefined}
        />
        {e.title && (
          <p className="st-error" id={`${idPrefix}-te`}>
            {e.title}
          </p>
        )}
      </div>
      <div className="st-field">
        <label htmlFor={`${idPrefix}-n`}>Notes (optional)</label>
        <textarea
          id={`${idPrefix}-n`}
          name="note"
          maxLength={1000}
          aria-invalid={e.note ? true : undefined}
        />
        {e.note && <p className="st-error">{e.note}</p>}
      </div>
      <button
        className="st-btn primary"
        disabled={!live || pending}
        aria-busy={pending}
      >
        {pending ? "Saving…" : "Save idea"}
      </button>
      {!live && <p className="st-hint">Preview: nothing is saved.</p>}
      <p
        role="status"
        aria-live="polite"
        className={state?.ok ? "st-ok" : "st-error"}
      >
        {state?.message}
      </p>
    </form>
  );
}
export type GoalOption = { key: string; label: string };
export function ObservationForm({
  action,
  goals,
  live = true,
  today,
  idPrefix = "obs",
}: {
  action?: Act;
  goals: GoalOption[];
  live?: boolean;
  today: string;
  idPrefix?: string;
}) {
  const { state, run, pending, formRef } = useIdempotent(action);
  const e = state?.errors ?? {};
  if (!goals.length)
    return (
      <p className="st-hint">
        You have no goal with a number to track yet.{" "}
        <Link href="/onboarding/creator/goals">
          Add a measurable target to a goal
        </Link>
        . The target itself can be left blank.
      </p>
    );
  return (
    <form action={run} ref={formRef} noValidate aria-label="Record progress">
      <div className="st-field">
        <label htmlFor={`${idPrefix}-g`}>Goal</label>
        <select
          id={`${idPrefix}-g`}
          name="goal"
          defaultValue={goals[0].key}
          aria-invalid={e.goal ? true : undefined}
        >
          {goals.map((g) => (
            <option key={g.key} value={g.key}>
              {g.label}
            </option>
          ))}
        </select>
        {e.goal && <p className="st-error">{e.goal}</p>}
      </div>
      <div className="st-field">
        <label htmlFor={`${idPrefix}-v`}>Your number right now</label>
        <input
          id={`${idPrefix}-v`}
          name="value"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          required
          aria-invalid={e.value ? true : undefined}
          aria-describedby={`${idPrefix}-vh`}
        />
        <p className="st-hint" id={`${idPrefix}-vh`}>
          Zero is a real answer. Leave this form alone if you do not know yet.
        </p>
        {e.value && <p className="st-error">{e.value}</p>}
      </div>
      <div className="st-field">
        <label htmlFor={`${idPrefix}-d`}>Date</label>
        <input
          id={`${idPrefix}-d`}
          name="observed_on"
          type="date"
          defaultValue={today}
          max={today}
          required
          aria-invalid={e.observed_on ? true : undefined}
        />
        {e.observed_on && <p className="st-error">{e.observed_on}</p>}
      </div>
      <div className="st-field">
        <label htmlFor={`${idPrefix}-n`}>Note (optional)</label>
        <input id={`${idPrefix}-n`} name="note" maxLength={200} />
      </div>
      <button
        className="st-btn primary"
        disabled={!live || pending}
        aria-busy={pending}
      >
        {pending ? "Saving…" : "Record progress"}
      </button>
      {!live && <p className="st-hint">Preview: nothing is saved.</p>}
      <p
        role="status"
        aria-live="polite"
        className={state?.ok ? "st-ok" : "st-error"}
      >
        {state?.message}
      </p>
    </form>
  );
}
