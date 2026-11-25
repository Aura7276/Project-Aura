"use client";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "./actions";
import type { FieldErrors } from "./schemas";
import type { StepId, StepStatus } from "./types";

export const flow: { id: StepId | "review"; label: string }[] = [
  { id: "identity", label: "About you" },
  { id: "social", label: "Accounts" },
  { id: "niche", label: "Niche" },
  { id: "goals", label: "Goals" },
  { id: "challenges", label: "Challenges" },
  { id: "preferences", label: "Preferences" },
  { id: "review", label: "Review" },
];
export function Progress({
  current,
  statuses,
}: {
  current: string;
  statuses: Partial<Record<string, StepStatus>>;
}) {
  const index = Math.max(
    0,
    flow.findIndex((f) => f.id === current),
  );
  return (
    <nav className="ob-progress" aria-label="Onboarding progress">
      <ol>
        {flow.map((f) => (
          <li
            key={f.id}
            data-state={statuses[f.id] ?? "pending"}
            aria-current={f.id === current ? "step" : undefined}
          >
            <span className="ob-sr">
              {f.label}:{" "}
              {f.id === current ? "current" : (statuses[f.id] ?? "not started")}
            </span>
          </li>
        ))}
      </ol>
      <p>
        Step {index + 1} of {flow.length}: {flow[index]?.label}
      </p>
    </nav>
  );
}
function Buttons({
  optional,
  backHref,
  canExit,
}: {
  optional: boolean;
  backHref: string | null;
  canExit: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <div className="ob-actions">
      {backHref && (
        <Link className="ob-btn quiet" href={backHref}>
          Back
        </Link>
      )}
      <button
        className="ob-btn primary"
        name="intent"
        value="continue"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "Saving…" : "Continue"}
      </button>
      {optional && (
        <button
          className="ob-btn quiet"
          name="intent"
          value="skip"
          formNoValidate
          disabled={pending}
        >
          Skip for now
        </button>
      )}
      {canExit && (
        <button
          className="ob-btn link"
          name="intent"
          value="save_exit"
          disabled={pending}
        >
          Save and exit
        </button>
      )}
    </div>
  );
}
export function StepShell({
  step,
  revision,
  title,
  intro,
  payload,
  optional = false,
  backHref,
  action,
  statuses,
  children,
  canExit = true,
  notice,
}: {
  step: StepId;
  revision: number;
  title: string;
  intro: string;
  payload: unknown;
  optional?: boolean;
  backHref: string | null;
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  statuses: Partial<Record<string, StepStatus>>;
  children: (errors: FieldErrors) => React.ReactNode;
  canExit?: boolean;
  notice?: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);
  const errors = state?.errors ?? {};
  const list = Object.entries(errors);
  return (
    <>
      <Progress current={step} statuses={statuses} />
      <h1 id="step-title" tabIndex={-1}>
        {title}
      </h1>
      <p className="ob-lede">{intro}</p>
      {optional && (
        <p className="ob-hint">
          This step is optional. You can skip it and come back later.
        </p>
      )}
      {notice}
      <form
        className="ob-form"
        action={formAction}
        aria-labelledby="step-title"
        noValidate
      >
        <input type="hidden" name="step" value={step} />
        <input type="hidden" name="revision" value={revision} />
        <input type="hidden" name="payload" value={JSON.stringify(payload)} />
        {state?.message && (
          <div className="ob-note warn" role="alert">
            <strong>{state.message}</strong>
            {list.length > 0 && (
              <ul>
                {list.map(([k, m]) => (
                  <li key={k}>{m}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {children(errors)}
        <Buttons optional={optional} backHref={backHref} canExit={canExit} />
      </form>
    </>
  );
}
