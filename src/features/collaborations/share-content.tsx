"use client";
import { useState, useRef } from "react";
import { contentOptions } from "./content-actions";
import type { Command, Deliverable } from "./model";
export type ContentOption = {
  id: string;
  revision: number;
  title: string;
  body: string;
  caption: string;
};
export function ShareContent({
  collaboration,
  deliverable,
  run,
}: {
  collaboration: string;
  deliverable: Deliverable;
  run: (c: Command, r: string) => Promise<string | null>;
}) {
  const [options, setOptions] = useState<ContentOption[] | null>(null),
    [selected, setSelected] = useState(""),
    [body, setBody] = useState(false),
    [caption, setCaption] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const retry = useRef<{ value: string; id: string } | null>(null);
  const item = options?.find((o) => o.id === selected);
  async function load() {
    setBusy(true);
    try {
      const result = await contentOptions(collaboration);
      if (result.error) setError(result.error);
      else setOptions(result.items || []);
    } catch {
      setError("Your Content Studio could not be loaded.");
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    if (!item || (!body && !caption)) return;
    const fields: ("body" | "caption")[] = [];
    if (body) fields.push("body");
    if (caption) fields.push("caption");
    const command: Command = {
      type: "share",
      deliverable: deliverable.id,
      stage: deliverable.stage,
      content: item.id,
      contentRevision: item.revision,
      fields,
    };
    const value = JSON.stringify(command);
    if (retry.current?.value !== value)
      retry.current = { value, id: crypto.randomUUID() };
    setBusy(true);
    const problem = await run(command, retry.current.id);
    setBusy(false);
    if (problem) setError(problem);
    else {
      setOptions(null);
      setSelected("");
      setBody(false);
      setCaption(false);
      setError("");
    }
  }
  return (
    <details className="co-content-share">
      <summary>Submit selected Content Studio text</summary>
      <p>
        Choose the exact saved version and text to share. Other drafts stay
        private.
      </p>
      {options === null ? (
        <button disabled={busy} onClick={load}>
          Choose saved content
        </button>
      ) : (
        <>
          <label>
            Saved content
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Select a draft</option>
              {options.map((o) => (
                <option value={o.id} key={o.id}>
                  {o.title} · version {o.revision}
                </option>
              ))}
            </select>
          </label>
          {item && (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={body}
                  onChange={(e) => setBody(e.target.checked)}
                />{" "}
                Script and storyboard
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={caption}
                  onChange={(e) => setCaption(e.target.checked)}
                />{" "}
                Caption
              </label>
              <pre>
                {[body ? item.body : "", caption ? item.caption : ""]
                  .filter(Boolean)
                  .join("\n\n") || "Select the text to share."}
              </pre>
              <button
                className="co-primary"
                disabled={busy || (!body && !caption)}
                onClick={share}
              >
                Confirm and submit selected text
              </button>
            </>
          )}
        </>
      )}
      <p role="alert">{error}</p>
    </details>
  );
}
