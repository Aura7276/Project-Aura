"use client";
import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  commandSchema,
  metrics,
  tracks,
  dateKey,
  type Home,
  type Command,
  type Task,
} from "./model";
export type Edit = { type: "focus" | "task" | "observation"; task?: Task };
export function BrandForm({
  edit,
  home,
  close,
  run,
}: {
  edit: Edit;
  home: Home;
  close: () => void;
  run: (c: Command, r: string) => Promise<string | null>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const id = useRef(edit.task?.id || crypto.randomUUID()),
    retry = useRef<{ body: string; id: string } | null>(null);
  async function submit(form: FormData) {
    const fields = Object.fromEntries(form.entries());
    const raw =
      edit.type === "focus"
        ? { ...fields, type: "focus", horizon: Number(fields.horizon) }
        : edit.type === "observation"
          ? { ...fields, type: "observation", value: Number(fields.value) }
          : { ...fields, type: "task", id: id.current };
    const parsed = commandSchema.safeParse(raw);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Check your entries.");
      return;
    }
    const body = JSON.stringify(parsed.data);
    if (retry.current?.body !== body)
      retry.current = { body, id: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      const problem = await run(parsed.data, retry.current.id);
      if (problem) setError(problem);
      else close();
    } catch {
      setError("Connection interrupted. Your entries are preserved for retry.");
    } finally {
      setBusy(false);
    }
  }
  const title =
    edit.type === "focus"
      ? "Set your direction"
      : edit.type === "task"
        ? "Shape the next step"
        : "Record an observation";
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) close();
      }}
    >
      <DialogContent className="bh-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {edit.type === "observation"
              ? "Use an actual observation and record where it came from."
              : "Private to authorized members of this Brand workspace."}
          </DialogDescription>
        </DialogHeader>
        <form action={submit}>
          <fieldset disabled={busy}>
            {edit.type === "focus" && (
              <>
                <label>
                  Primary objective
                  <input
                    name="objective"
                    required
                    maxLength={180}
                    defaultValue={home.focus.objective}
                    placeholder="What matters most for your Brand?"
                  />
                </label>
                <label>
                  Planning horizon
                  <select name="horizon" defaultValue={home.focus.horizon}>
                    {[7, 30, 90].map((n) => (
                      <option key={n} value={n}>
                        {n} days
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Audience context
                  <textarea
                    name="audience"
                    maxLength={1000}
                    defaultValue={home.focus.audience}
                    placeholder="Who are you trying to reach?"
                  />
                </label>
                <label>
                  Available resources
                  <textarea
                    name="resources"
                    maxLength={1000}
                    defaultValue={home.focus.resources}
                    placeholder="Time, people and production resources"
                  />
                </label>
              </>
            )}
            {edit.type === "task" && (
              <>
                <label>
                  Priority
                  <input
                    name="title"
                    required
                    maxLength={180}
                    defaultValue={edit.task?.title}
                    placeholder="A specific next step"
                  />
                </label>
                <div className="bh-form-grid">
                  <label>
                    Workstream
                    <select
                      name="track"
                      defaultValue={edit.task?.track || tracks[0]}
                    >
                      {tracks.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Target date
                    <input
                      type="date"
                      name="due"
                      defaultValue={edit.task?.due}
                    />
                  </label>
                </div>
                <label>
                  Working notes
                  <textarea
                    name="note"
                    maxLength={3000}
                    defaultValue={edit.task?.note}
                  />
                </label>
              </>
            )}
            {edit.type === "observation" && (
              <>
                <div className="bh-form-grid">
                  <label>
                    Metric
                    <select name="metric">
                      {metrics.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Observed value
                    <input
                      type="number"
                      name="value"
                      required
                      min={0}
                      max={1e12}
                      step={1}
                    />
                  </label>
                </div>
                <label>
                  Channel or account
                  <input
                    name="channel"
                    required
                    maxLength={180}
                    placeholder="Specify the account or reporting source"
                  />
                </label>
                <label>
                  Observation date
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={dateKey()}
                    max={dateKey()}
                  />
                </label>
                <label>
                  Source
                  <input
                    name="source"
                    required
                    maxLength={180}
                    placeholder="e.g. account analytics export"
                  />
                </label>
                <label>
                  Period, coverage and limitations
                  <textarea name="note" maxLength={2000} />
                </label>
              </>
            )}
            <p role="alert">{error}</p>
            <footer>
              <button type="button" onClick={close}>
                Cancel
              </button>
              <button className="bh-primary" type="submit">
                {busy ? "Saving…" : "Save changes"}
              </button>
            </footer>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
