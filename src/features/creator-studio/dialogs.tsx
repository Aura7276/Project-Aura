"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import type { FormState } from "./actions";
import { IdeaForm, ObservationForm, type GoalOption } from "./forms";
import { areaFor, areas } from "./nav";
import { assistantManualTools } from "./assistant";

const close = (id: string) => () =>
  (document.getElementById(id) as HTMLDialogElement | null)?.close();
type Act = (prev: FormState, form: FormData) => Promise<FormState>;
export function QuickCreate({
  goals,
  today,
  live,
  captureIdea,
  recordObservation,
}: {
  goals: GoalOption[];
  today: string;
  live: boolean;
  captureIdea?: Act;
  recordObservation?: Act;
}) {
  const id = "quick-create-dialog";
  return (
    <dialog
      id={id}
      className="st-dialog"
      aria-labelledby="qc-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) close(id)();
      }}
    >
      <div className="in">
        <header>
          <h2 id="qc-title">Quick create</h2>
          <button
            type="button"
            className="st-iconbtn"
            onClick={close(id)}
            aria-label="Close quick create"
          >
            <X aria-hidden size={18} />
          </button>
        </header>
        <p className="st-hint">Only things that work today are listed.</p>
        <section aria-labelledby="qc-idea">
          <h3 id="qc-idea">Capture an idea</h3>
          <IdeaForm action={captureIdea} live={live} idPrefix="qc-idea" />
        </section>
        <section aria-labelledby="qc-prog">
          <h3 id="qc-prog">Record progress</h3>
          <ObservationForm
            action={recordObservation}
            goals={goals}
            live={live}
            today={today}
            idPrefix="qc-obs"
          />
        </section>
        <section aria-labelledby="qc-goal">
          <h3 id="qc-goal">Goals and plan</h3>
          <p className="st-hint">Goals use the same form as onboarding.</p>
          <Link
            className="st-btn"
            href="/onboarding/creator/goals"
            onClick={close(id)}
          >
            Edit my goals
          </Link>
        </section>
        <section aria-labelledby="qc-port">
          <h3 id="qc-port">Portfolio</h3>
          <p className="st-hint">Portfolio and media kit tools are planned.</p>
          <button type="button" className="st-btn" disabled>
            Add portfolio item
          </button>
        </section>
      </div>
    </dialog>
  );
}
export function AssistantDialog({
  workspaceName,
  available,
  reason,
  pathname: forced,
}: {
  pathname?: string;
  workspaceName: string;
  available: boolean;
  reason: string;
}) {
  const id = "assistant-dialog";
  const real = usePathname();
  const pathname = forced ?? real;
  const area = areas.find((a) => a.id === areaFor(pathname))?.label ?? "Home";
  return (
    <dialog
      id={id}
      className="st-dialog"
      aria-labelledby="as-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) close(id)();
      }}
    >
      <div className="in">
        <header>
          <h2 id="as-title">Growth Assistant</h2>
          <button
            type="button"
            className="st-iconbtn"
            onClick={close(id)}
            aria-label="Close assistant"
          >
            <X aria-hidden size={18} />
          </button>
        </header>
        <p className="st-hint">
          Workspace: <strong>{workspaceName}</strong> · Page:{" "}
          <strong>{area}</strong>
        </p>
        {available ? null : (
          <p className="st-notice" role="status">
            {reason}
          </p>
        )}
        <p>
          <Link href="/creator/ai">Open Growth Studio</Link>
        </p>
        <h3>Things you can do now</h3>
        <ul className="st-list">
          {assistantManualTools.map((t) => (
            <li key={t.href}>
              <Link className="st-btn" href={t.href} onClick={close(id)}>
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="st-hint">
          When the assistant arrives it will only see this workspace’s data.
        </p>
      </div>
    </dialog>
  );
}
