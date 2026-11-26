"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Copy, History, Layers, Save } from "lucide-react";
import {
  formats,
  stages,
  outlines,
  type Item,
  type Version,
  type RecordItem,
} from "./model";
import { DraftReview } from "./review";
export type Persist = (
  i: Item,
  r: number,
) => Promise<{ revision?: number; error?: string }>;
export function Editor({
  record,
  save,
  history,
  close,
  adapt,
  live = false,
}: {
  live?: boolean;
  record: RecordItem;
  save: Persist;
  history: (id: string) => Promise<Version[]>;
  close: () => void;
  adapt: (i: Item) => void;
}) {
  const [item, set] = useState(record.item),
    [tab, tabTo] = useState("Write"),
    [status, message] = useState(""),
    [versions, setVersions] = useState<Version[]>([]);
  const base = useRef(record.item),
    rev = useRef(record.revision),
    latest = useRef(item),
    active = useRef<Promise<boolean> | null>(null);
  const setField = <K extends keyof Item>(k: K, v: Item[K]) =>
    set((old) => ({ ...old, [k]: v }));
  async function flush(): Promise<boolean> {
    if (active.current) {
      if (!(await active.current)) return false;
      return flush();
    }
    const target = latest.current;
    if (target === base.current && rev.current > 0) return true;
    const job = (async () => {
      try {
        message("Saving…");
        const result = await save(target, rev.current);
        if (!result.revision) {
          message(result.error || "Save failed.");
          return false;
        }
        rev.current = result.revision;
        base.current = target;
        message("Saved");
        return true;
      } catch {
        message("Save interrupted. Retry when connected.");
        return false;
      }
    })();
    active.current = job;
    try {
      return await job;
    } finally {
      active.current = null;
    }
  }
  const flushRef = useRef(flush);
  useEffect(() => {
    latest.current = item;
    flushRef.current = flush;
  });
  useEffect(() => {
    if (item === base.current) return;
    const timer = setTimeout(() => void flushRef.current(), 1100);
    return () => clearTimeout(timer);
  }, [item]);
  const fields = (
    key: "body" | "caption" | "production" | "checklist" | "observation",
    label: string,
    placeholder: string,
  ) => (
    <label>
      {label}
      <textarea
        value={item[key]}
        placeholder={placeholder}
        onChange={(e) => setField(key, e.target.value)}
      />
    </label>
  );
  return (
    <section className="cs-editor">
      <div className="cs-toolbar">
        <button
          onClick={async () => {
            if (await flush()) close();
          }}
        >
          <ArrowLeft /> Studio
        </button>
        <span role="status">{status}</span>
        <button onClick={() => void flush()}>
          <Save /> Save
        </button>
      </div>
      <input
        className="cs-title"
        aria-label="Content title"
        value={item.title}
        onChange={(e) => setField("title", e.target.value)}
      />
      <div className="cs-tabs">
        {["Write", "Production", "Publish", "History"].map((t) => (
          <button
            key={t}
            aria-pressed={tab === t}
            onClick={async () => {
              tabTo(t);
              if (t === "History") {
                try {
                  if (await flush()) setVersions(await history(item.id));
                } catch {
                  message("Could not load versions.");
                }
              }
            }}
          >
            {t === "History" && <History />}
            {t}
          </button>
        ))}
      </div>
      {tab === "Write" && (
        <>
          <div className="cs-fields">
            <label>
              Format
              <select
                value={item.format}
                onChange={(e) =>
                  setField("format", e.target.value as Item["format"])
                }
              >
                {formats.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label>
              Content pillar
              <input
                value={item.pillar}
                onChange={(e) => setField("pillar", e.target.value)}
              />
            </label>
            <label>
              Tags
              <input
                value={item.tags}
                onChange={(e) => setField("tags", e.target.value)}
              />
            </label>
          </div>
          {fields(
            "body",
            "Script & storyboard",
            "Start with the opening frame…",
          )}
          <button
            onClick={() =>
              setField(
                "body",
                [item.body, outlines[item.format]].filter(Boolean).join("\n\n"),
              )
            }
          >
            <Layers /> Insert {item.format.toLowerCase()} outline
          </button>
          {fields(
            "caption",
            "Caption, CTA & hashtags",
            "What should your audience take away?",
          )}
          <label>
            Inspiration URL
            <input
              type="url"
              value={item.reference}
              onChange={(e) => setField("reference", e.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={item.template}
              onChange={(e) => setField("template", e.target.checked)}
            />{" "}
            Reuse as a template
          </label>
          <button
            onClick={async () => {
              if (await flush()) adapt(item);
            }}
          >
            <Copy /> Create adaptation
          </button>
        </>
      )}
      {tab === "Production" && (
        <>
          <div className="cs-fields">
            <label>
              Stage
              <select
                value={item.stage}
                onChange={(e) =>
                  setField("stage", e.target.value as Item["stage"])
                }
              >
                {stages.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Planned date
              <input
                type="date"
                value={item.day}
                onChange={(e) => setField("day", e.target.value)}
              />
            </label>
            <label>
              Repeat
              <select
                value={item.recurring}
                onChange={(e) =>
                  setField("recurring", e.target.value as Item["recurring"])
                }
              >
                {["Once", "Weekly", "Monthly"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          {fields(
            "production",
            "Production notes",
            "Equipment, time estimate and shot list…",
          )}
          {fields("checklist", "Checklist", "One production step per line…")}
          <label>
            <input
              type="checkbox"
              checked={item.commercial}
              onChange={(e) => setField("commercial", e.target.checked)}
            />{" "}
            Sponsored content
          </label>
        </>
      )}
      {tab === "Publish" && (
        <>
          {live && (
            <DraftReview
              item={item}
              apply={(text) =>
                setField(
                  "production",
                  [item.production, text]
                    .filter(Boolean)
                    .join("\n\n")
                    .slice(0, 6000),
                )
              }
            />
          )}
          {item.commercial && (
            <p>
              Confirm the campaign approval and sponsored disclosure before
              publishing.
            </p>
          )}
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(item.caption || item.body);
                message("Copied");
              } catch {
                message("Copy unavailable. Select the text in Write.");
              }
            }}
          >
            <Copy /> Copy publication text
          </button>
          <label>
            Published URL
            <input
              type="url"
              value={item.published}
              onChange={(e) => setField("published", e.target.value)}
              placeholder="Paste the live post URL"
            />
          </label>
          {fields(
            "observation",
            "Performance notes",
            "Record an observation from the published post…",
          )}
        </>
      )}
      {tab === "History" &&
        versions.map((v) => (
          <div key={v.revision} className="cs-version">
            <span>
              Version {v.revision} · {new Date(v.at).toLocaleString()}
            </span>
            <button
              onClick={() => {
                set({ ...v.item });
                tabTo("Write");
              }}
            >
              Restore
            </button>
          </div>
        ))}
    </section>
  );
}
