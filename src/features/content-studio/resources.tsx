"use client";
import { useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import { type Resource, resourceSchema } from "./resources-model";
export type StoreResource = (r: Resource) => Promise<{ error?: string }>;
export function Resources({
  initial,
  kind,
  store,
  onUse,
  query,
  offline,
}: {
  initial: Resource[];
  kind: Resource["kind"];
  store: StoreResource;
  onUse: (r: Resource) => void;
  query: string;
  offline: boolean;
}) {
  const [edit, setEdit] = useState<Resource | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const field = (k: "name" | "note" | "url", v: string) =>
    setEdit((old) => old && { ...old, [k]: v });
  async function save() {
    const parsed = resourceSchema.safeParse(edit);
    if (!parsed.success) {
      setMessage("Check the name, link and target mix.");
      return;
    }
    setBusy(true);
    try {
      const result = await store(parsed.data);
      if (result.error) setMessage(result.error);
      else {
        setEdit(null);
        setMessage("Saved");
      }
    } catch {
      setMessage("Could not save. Retry when connected.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="cs-resources">
      <button
        disabled={offline}
        onClick={() => {
          setMessage("");
          setEdit({
            id: crypto.randomUUID(),
            kind,
            name: "",
            note: "",
            url: "",
            mix: null,
          });
        }}
      >
        <Plus /> {kind === "pillar" ? "New pillar" : "Add reference"}
      </button>
      <span role="status">{message}</span>
      {edit && (
        <fieldset className="cs-editor" disabled={busy}>
          <legend>
            {kind === "pillar" ? "Content pillar" : "Private reference"}
          </legend>
          <label>
            Name
            <input
              value={edit.name}
              onChange={(e) => field("name", e.target.value)}
            />
          </label>
          <label>
            Notes
            <textarea
              value={edit.note}
              onChange={(e) => field("note", e.target.value)}
            />
          </label>
          {kind === "pillar" ? (
            <label>
              Target mix (%) · optional
              <input
                type="number"
                min="0"
                max="100"
                value={edit.mix ?? ""}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    mix: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </label>
          ) : (
            <label>
              Source URL · optional
              <input
                type="url"
                value={edit.url}
                onChange={(e) => field("url", e.target.value)}
              />
            </label>
          )}
          <button onClick={save}>Save</button>
          <button onClick={() => setEdit(null)}>Cancel</button>
        </fieldset>
      )}
      <div className="cs-resource-list">
        {initial
          .filter(
            (r) =>
              r.kind === kind &&
              (r.name + " " + r.note)
                .toLowerCase()
                .includes(query.toLowerCase()),
          )
          .map((r) => (
            <article key={r.id}>
              <BookOpen />
              <h3>{r.name}</h3>
              <p>{r.note}</p>
              {r.mix !== null && <small>{r.mix}% target mix</small>}
              {r.url && (
                <a href={r.url} target="_blank" rel="noreferrer">
                  Open source ↗
                </a>
              )}
              <footer>
                <button onClick={() => setEdit(r)}>Edit</button>
                <button onClick={() => onUse(r)}>Use in draft</button>
              </footer>
            </article>
          ))}
      </div>
    </div>
  );
}
