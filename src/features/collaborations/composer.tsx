"use client";
import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  commandSchema,
  type Command,
  type Collaboration,
  type Deliverable,
  type Change,
  type Dispute,
} from "./model";
export type Action =
  | { type: "accept"; version: number }
  | { type: "submit" | "fulfil" | "review"; deliverable: Deliverable }
  | { type: "change"; kind?: Change["kind"] }
  | { type: "respond"; change: Change; accept: boolean }
  | { type: "dispute" }
  | { type: "evidence" | "resolve" | "confirmResolution"; dispute: Dispute }
  | { type: "performance" | "complete" }
  | { type: "dependency"; dependency: Collaboration["dependencies"][number] };
type Field = {
  key: string;
  label: string;
  type?: "textarea" | "url" | "date";
  options?: string[];
  required?: boolean;
  value?: string;
};
function fieldsFor(action: Action): Field[] {
  switch (action.type) {
    case "submit":
      return [
        { key: "url", label: "Submission link", type: "url", required: true },
        {
          key: "note",
          label: "What should the reviewer know?",
          type: "textarea",
          required: true,
        },
      ];
    case "review":
      return [
        {
          key: "decision",
          label: "Decision",
          options: ["Approved", "Revision requested", "Concern raised"],
        },
        {
          key: "scope",
          label: "Feedback relates to",
          options: [
            "Agreed requirement",
            "Voluntary improvement",
            "Additional request",
          ],
        },
        {
          key: "note",
          label: "Feedback and relevant agreed requirement",
          type: "textarea",
          required: true,
        },
      ];
    case "fulfil":
      return [
        {
          key: "url",
          label:
            action.deliverable.stage === "Handover"
              ? "Authorized handover link"
              : "Published URL or fulfilment evidence",
          type: "url",
          required: true,
        },
        {
          key: "date",
          label: "Actual fulfilment date",
          type: "date",
          required: true,
        },
        {
          key: "note",
          label: "Evidence notes",
          type: "textarea",
          required: true,
        },
      ];
    case "change":
      return [
        {
          key: "kind",
          label: "Proposal type",
          options: ["Amendment", "Reschedule", "Cancellation", "Renewal"],
          value: action.kind || "Amendment",
        },
        { key: "title", label: "Proposal title", required: true },
        {
          key: "details",
          label: "Proposed change and affected obligations",
          type: "textarea",
          required: true,
        },
        { key: "compensation", label: "Compensation impact" },
        { key: "date", label: "Proposed date", type: "date" },
      ];
    case "dispute":
      return [
        { key: "title", label: "Concern", required: true },
        {
          key: "details",
          label: "What happened and which obligation is affected?",
          type: "textarea",
          required: true,
        },
        {
          key: "amount",
          label: "Disputed amount, currency and basis · optional",
        },
      ];
    case "evidence":
      return [
        { key: "url", label: "Evidence link · optional", type: "url" },
        {
          key: "note",
          label: "Evidence or response",
          type: "textarea",
          required: true,
        },
      ];
    case "resolve":
      return [
        {
          key: "note",
          label: "Proposed mutual resolution",
          type: "textarea",
          required: true,
        },
      ];
    case "performance":
      return [
        { key: "metric", label: "Agreed metric", required: true },
        { key: "value", label: "Recorded value and unit", required: true },
        { key: "period", label: "Measurement period", required: true },
        { key: "source", label: "Evidence URL", type: "url", required: true },
      ];
    case "dependency":
      return [
        {
          key: "done",
          label: "Status",
          options: ["Waiting", "Done"],
          value: action.dependency.done ? "Done" : "Waiting",
        },
        {
          key: "note",
          label: "Update or delay reason",
          type: "textarea",
          required: true,
        },
      ];
    default:
      return [];
  }
}
const labels: Record<Action["type"], string> = {
  accept: "Accept this agreement",
  submit: "Submit for review",
  review: "Review submission",
  fulfil: "Record fulfilment",
  change: "Propose a change",
  respond: "Respond to proposal",
  dispute: "Raise a concern",
  evidence: "Add evidence or response",
  resolve: "Propose a resolution",
  confirmResolution: "Confirm resolution",
  performance: "Record performance",
  complete: "Confirm operational completion",
  dependency: "Update dependency",
};
export function Composer({
  action,
  collaboration,
  close,
  run,
}: {
  action: Action;
  collaboration: Collaboration;
  close: () => void;
  run: (command: Command, request: string) => Promise<string | null>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const retry = useRef<{ value: string; request: string } | null>(null);
  async function submit(form: FormData) {
    const values = Object.fromEntries(form.entries());
    let raw: unknown;
    switch (action.type) {
      case "accept":
        raw = { type: action.type, version: action.version };
        break;
      case "submit":
        raw = {
          ...values,
          type: action.type,
          deliverable: action.deliverable.id,
          stage: action.deliverable.stage,
        };
        break;
      case "review":
        raw = {
          ...values,
          type: action.type,
          deliverable: action.deliverable.id,
          submission: action.deliverable.submissions.at(-1)?.id,
        };
        break;
      case "fulfil":
        raw = {
          ...values,
          type: action.type,
          deliverable: action.deliverable.id,
        };
        break;
      case "respond":
        raw = {
          type: action.type,
          change: action.change.id,
          accept: action.accept,
        };
        break;
      case "evidence":
      case "resolve":
      case "confirmResolution":
        raw = { ...values, type: action.type, dispute: action.dispute.id };
        break;
      case "dependency":
        raw = {
          ...values,
          type: action.type,
          dependency: action.dependency.id,
          done: values.done === "Done",
        };
        break;
      default:
        raw = { ...values, type: action.type };
    }
    const result = commandSchema.safeParse(raw);
    if (!result.success) {
      setError(result.error.issues[0]?.message || "Check the required fields.");
      return;
    }
    const value = JSON.stringify(result.data);
    if (retry.current?.value !== value)
      retry.current = { value, request: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      const problem = await run(result.data, retry.current.request);
      if (problem) setError(problem);
      else close();
    } catch {
      setError(
        "Connection interrupted. Your entries are preserved; retry when connected.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <DialogContent className="co-dialog">
        <DialogHeader>
          <DialogTitle>{labels[action.type]}</DialogTitle>
          <DialogDescription>
            {action.type === "accept"
              ? "Your acceptance records the exact version and your identity."
              : action.type === "complete"
                ? "Confirm that agreed approvals, fulfilment and reporting are complete. Financial settlement is tracked separately."
                : action.type === "respond"
                  ? action.change.title
                  : action.type === "confirmResolution"
                    ? action.dispute.resolution?.note ||
                      "Confirm the resolution proposed by the other party."
                    : "Shared with authorized participants in this collaboration."}
          </DialogDescription>
        </DialogHeader>
        <form action={submit}>
          <fieldset disabled={busy}>
            {fieldsFor(action).map((f) => (
              <label key={f.key}>
                {f.label}
                {f.options ? (
                  <select name={f.key} defaultValue={f.value || f.options[0]}>
                    {f.options.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    name={f.key}
                    required={f.required}
                    maxLength={6000}
                    rows={4}
                  />
                ) : (
                  <input
                    name={f.key}
                    type={f.type || "text"}
                    required={f.required}
                    maxLength={f.type === "url" ? 2048 : 180}
                  />
                )}
              </label>
            ))}
            {(action.type === "change" || action.type === "dispute") && (
              <label>
                Affected deliverable
                <select name="deliverable">
                  <option value="">Entire collaboration</option>
                  {collaboration.deliverables.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {action.type === "accept" && (
              <p className="co-confirm-note">
                Agreement version {action.version}
              </p>
            )}
            {["accept", "complete", "respond", "confirmResolution"].includes(
              action.type,
            ) && (
              <label className="co-confirm">
                <input required type="checkbox" /> I have reviewed the details
                and confirm this action.
              </label>
            )}
            <p role="alert" className="co-form-error">
              {error}
            </p>
            <div className="co-form-actions">
              <button type="button" onClick={close}>
                Cancel
              </button>
              <button className="co-primary" type="submit">
                {busy ? "Saving…" : labels[action.type]}
              </button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
