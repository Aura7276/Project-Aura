"use client";
import { useState, useRef } from "react";
import {
  Aperture,
  BookOpen,
  Layers as LayersIcon,
  ArrowUpRight,
  CalendarDays,
  Clapperboard,
  Columns3,
  Film,
  FolderOpen,
  LayoutTemplate,
  Lightbulb,
  Plus,
  Search,
} from "lucide-react";
import { Calendar } from "./calendar";
import { Editor, type Persist } from "./editor";
import {
  fresh,
  itemSchema,
  stages,
  type Item,
  type RecordItem,
  type Idea,
  type Version,
} from "./model";
import "./studio.css";
import { Resources, type StoreResource } from "./resources";
import { type Resource } from "./resources-model";
const sections = [
  ["Library", FolderOpen],
  ["Calendar", CalendarDays],
  ["Board", Columns3],
  ["Ideas", Lightbulb],
  ["Templates", LayoutTemplate],
  ["Pillars", LayersIcon],
  ["References", BookOpen],
] as const;
export function ContentStudio({
  initial,
  ideas,
  initialView = "Library",
  preview = false,
  offline = false,
  saveAction,
  historyAction,
  initialResources = [],
  resourceAction,
}: {
  initialResources?: Resource[];
  resourceAction?: StoreResource;
  initial: RecordItem[];
  ideas: Idea[];
  initialView?: string;
  preview?: boolean;
  offline?: boolean;
  saveAction?: Persist;
  historyAction?: (id: string) => Promise<Version[]>;
}) {
  const [records, update] = useState(initial),
    [section, select] = useState(initialView),
    [editing, edit] = useState<RecordItem | null>(null),
    [query, search] = useState(""),
    [filter, setFilter] = useState("All content");
  const [resources, setResources] = useState(initialResources);
  const store: StoreResource = async (r) => {
    const result = preview
      ? {}
      : resourceAction
        ? await resourceAction(r)
        : { error: "Content storage unavailable." };
    if (!result.error)
      setResources((old) => [r, ...old.filter((x) => x.id !== r.id)]);
    return result;
  };
  const logs = useRef<Record<string, Version[]>>({});
  const items = records
    .map((r) => r.item)
    .filter(
      (i) =>
        [i.title, i.tags, i.pillar, i.format]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (filter === "All content" ||
          (filter === "Sponsored" ? i.commercial : !i.commercial)),
    );
  function open(i: Item) {
    edit(records.find((r) => r.item.id === i.id) || { item: i, revision: 0 });
  }
  function create(overrides: Partial<Item> = {}) {
    edit({ item: { ...fresh(), ...overrides }, revision: 0 });
  }
  const save: Persist = async (i, r) => {
    const parsed = itemSchema.safeParse(i);
    if (!parsed.success)
      return { error: "Check the title, dates, links and field lengths." };
    const result = preview
      ? { revision: r + 1 }
      : saveAction
        ? await saveAction(i, r)
        : { error: "Content storage is unavailable." };
    if (result.revision) {
      const entry = { item: i, revision: result.revision };
      update((old) => [entry, ...old.filter((x) => x.item.id !== i.id)]);
      if (preview)
        logs.current[i.id] = [
          { ...entry, at: new Date().toISOString() },
          ...(logs.current[i.id] || []),
        ];
    }
    return result;
  };
  function adapt(i: Item) {
    create({
      ...i,
      id: crypto.randomUUID(),
      parent: i.id,
      template: false,
      title: i.title + " · adaptation",
      day: "",
      recurring: "Once",
      published: "",
      observation: "",
      stage: "Idea",
    });
  }
  return (
    <div className="cs">
      <header className="cs-mast">
        <div className="cs-emblem">
          <Aperture size={30} />
        </div>
        <div>
          <span>Creator workspace</span>
          <h1>Content Studio</h1>
        </div>
        {preview && <small>Interactive preview · illustrative content</small>}
      </header>
      {offline && (
        <p role="status">
          Content storage is unavailable. Your saved work will appear when the
          connection is restored.
        </p>
      )}
      {editing ? (
        <Editor
          live={!preview && !offline}
          key={editing.item.id}
          record={editing}
          save={save}
          history={historyAction || (async (id) => logs.current[id] || [])}
          close={() => edit(null)}
          adapt={adapt}
        />
      ) : (
        <>
          <div className="cs-rail">
            {sections.map(([name, Icon]) => (
              <button
                key={name}
                aria-pressed={section === name}
                onClick={() => select(name)}
              >
                <Icon />
                {name}
              </button>
            ))}
          </div>
          <div className="cs-section">
            <div>
              <h2>
                {section === "Library"
                  ? "On the slate"
                  : section === "Board"
                    ? "Production board"
                    : section === "Ideas"
                      ? "Idea inbox"
                      : section === "Calendar"
                        ? "Editorial calendar"
                        : section === "Pillars"
                          ? "Content pillars"
                          : section === "References"
                            ? "Reference shelf"
                            : "Creative templates"}
              </h2>
              <p>
                {section === "Library"
                  ? "Your scripts, shoots and stories in one place."
                  : section === "Calendar"
                    ? "Plan your next release."
                    : section === "Board"
                      ? "Follow each piece from first idea to final cut."
                      : section === "Ideas"
                        ? "Develop a saved idea into a working draft."
                        : section === "Pillars"
                          ? "Define the themes in your editorial mix."
                          : section === "References"
                            ? "Keep source links and notes for your next draft."
                            : "Start from a format outline or your own saved template."}
              </p>
            </div>
            <button
              className="cs-primary"
              disabled={offline}
              onClick={() => create()}
            >
              <Plus /> New draft
            </button>
          </div>
          <div className="cs-filter">
            <label>
              <Search />
              <input
                aria-label="Search studio"
                placeholder="Search studio…"
                value={query}
                onChange={(e) => search(e.target.value)}
              />
            </label>
            {section !== "Ideas" && (
              <select
                aria-label="Content filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                {["All content", "Organic", "Sponsored"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            )}
          </div>
          {(section === "Pillars" || section === "References") && (
            <Resources
              key={section}
              initial={resources}
              store={store}
              kind={section === "Pillars" ? "pillar" : "reference"}
              offline={offline}
              query={query}
              onUse={(r) =>
                create(
                  r.kind === "pillar"
                    ? { pillar: r.name }
                    : { reference: r.url, body: r.note, title: r.name },
                )
              }
            />
          )}
          {section === "Library" && (
            <div className="cs-list">
              {items.map((i, index) => (
                <button key={i.id} className="cs-row" onClick={() => open(i)}>
                  <span className={"cs-cover tint" + (index % 3)}>
                    <Film />
                  </span>
                  <span className="cs-row-name">
                    <small>
                      {i.format} {i.pillar && " / " + i.pillar}
                    </small>
                    <strong>{i.title}</strong>
                  </span>
                  <span>{i.day || "Unscheduled"}</span>
                  <b>{i.published ? "Published" : i.stage}</b>
                  <ArrowUpRight />
                </button>
              ))}
              {!items.length && (
                <div className="cs-empty">
                  <Clapperboard />
                  <h3>{query ? "No matching drafts" : "Your slate is open"}</h3>
                  <p>
                    {query
                      ? "Try a different title or tag."
                      : "Start a draft or develop an idea from your inbox."}
                  </p>
                </div>
              )}
            </div>
          )}
          {section === "Calendar" && (
            <Calendar
              items={items}
              open={open}
              create={(day) => {
                if (!offline) create({ day });
              }}
            />
          )}
          {section === "Board" && (
            <div className="cs-board">
              {stages.map((s) => (
                <section key={s}>
                  <h3>
                    {s}{" "}
                    <small>{items.filter((i) => i.stage === s).length}</small>
                  </h3>
                  {items
                    .filter((i) => i.stage === s)
                    .map((i) => (
                      <button key={i.id} onClick={() => open(i)}>
                        <small>{i.format}</small>
                        {i.title}
                      </button>
                    ))}
                </section>
              ))}
            </div>
          )}
          {section === "Ideas" && (
            <div className="cs-list">
              {ideas
                .filter((i) =>
                  (i.title + " " + (i.note || ""))
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((i) => (
                  <button
                    disabled={offline}
                    className="cs-row"
                    key={i.id}
                    onClick={() =>
                      create({ title: i.title, body: i.note || "", idea: i.id })
                    }
                  >
                    <Lightbulb />
                    <strong>{i.title}</strong>
                    <span>Develop idea</span>
                    <ArrowUpRight />
                  </button>
                ))}
              {!ideas.length && (
                <p>Ideas saved in Creator Studio appear here.</p>
              )}
              {!preview && <a href="/creator/create">Capture an idea ↗</a>}
            </div>
          )}
          {section === "Templates" && (
            <div className="cs-board">
              {Object.entries(outlinesForView)
                .filter(([f]) => f.toLowerCase().includes(query.toLowerCase()))
                .map(([f, body]) => (
                  <button
                    key={f}
                    disabled={offline}
                    onClick={() =>
                      create({
                        format: f as Item["format"],
                        title: f + " draft",
                        body,
                      })
                    }
                  >
                    <Film />
                    <strong>{f}</strong>
                    <small>Format outline</small>
                  </button>
                ))}
              {items
                .filter((i) => i.template)
                .map((i) => (
                  <button key={i.id} onClick={() => adapt(i)}>
                    <LayersIcon />
                    <strong>{i.title}</strong>
                    <small>Saved template</small>
                  </button>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
import { outlines as outlinesForView } from "./model";
