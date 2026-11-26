"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  Compass,
  Feather,
  Layers3,
  Lightbulb,
  Plus,
  Send,
} from "lucide-react";
import {
  type Commands,
  type Draft,
  type Memory,
  type Saved,
  type StudioState,
} from "./model";
import "./studio.css";
const modes = [
  ["Plan", "Growth plan", Compass],
  ["Content", "Content brief", Feather],
  ["Opportunity", "Review a brief", Layers3],
  ["Pitch", "Draft a pitch", Send],
] as const;
const prompts = {
  Plan: "What would you like to achieve?",
  Content: "What do you want to create?",
  Opportunity: "Which opportunity are you considering?",
  Pitch: "Who are you pitching, and what can you offer?",
};
export function GrowthStudio({
  initial,
  preview = false,
  provider,
  commands,
  offline = false,
}: {
  initial: StudioState;
  preview?: boolean;
  provider: boolean;
  commands?: Commands;
  offline?: boolean;
}) {
  const [tab, setTab] = useState("Workbench"),
    [kind, setKind] = useState<Draft["kind"]>("Plan"),
    [days, setDays] = useState<Draft["days"]>(7),
    [language, setLanguage] = useState<Draft["language"]>("English"),
    [brief, setBrief] = useState(""),
    [body, setBody] = useState(""),
    [id, setId] = useState(""),
    [drafts, setDrafts] = useState<Saved[]>(initial.drafts),
    [prefs, setPrefs] = useState<Memory>(
      initial.memory ?? { enabled: false, preferences: "" },
    ),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  const approved = drafts.some((d) => d.id === id && d.approved);
  function select(t: string) {
    setTab(t);
    setNotice("");
    setConfirm(false);
  }
  function open(d?: Saved) {
    setId(d?.id ?? "");
    setBrief(d?.brief ?? "");
    setBody(d?.body ?? "");
    setKind(d?.kind ?? "Plan");
    setLanguage(d?.language ?? "English");
    setDays(d?.days ?? 7);
    select("Workbench");
  }
  async function run(
    action: "save" | "generate" | "approve" | "memory" | "delete",
  ) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      if (action === "memory" || action === "delete") {
        const remove = action === "delete";
        const r = commands
          ? await commands.memory(prefs, remove)
          : {
              ok: preview,
              message: preview
                ? "Preview preferences updated."
                : "Storage unavailable.",
            };
        if (r.ok && remove) setPrefs({ enabled: false, preferences: "" });
        setNotice(r.message);
        return;
      }
      if (!brief.trim()) {
        setNotice("Add a brief to continue.");
        return;
      }
      const key = id || crypto.randomUUID();
      setId(key);
      const d = { id: key, kind, brief, body, days, language };
      if (!commands && !preview) {
        setNotice("Storage unavailable. Keep your draft open.");
        return;
      }
      if (action === "generate") {
        if (!commands) return;
        const r = await commands.generate(d);
        setNotice(r.message);
        if (r.body) {
          setBody(r.body);
          const reply = r.body;
          if (r.ok)
            setDrafts((old) => [
              {
                ...d,
                approved: false,
                history: [
                  ...(old.find((x) => x.id === key)?.history ?? []),
                  { prompt: d.brief, reply },
                ],
              },
              ...old.filter((x) => x.id !== key),
            ]);
        }
        return;
      }
      const r = commands
        ? await commands.save(d)
        : { ok: true, message: "Saved for this preview session." };
      if (!r.ok) {
        setNotice(r.message);
        return;
      }
      let done = false;
      if (action === "approve") {
        const a = commands
          ? await commands.approve(key)
          : {
              ok: true,
              message:
                "Preview approval complete. No workspace record created.",
            };
        setNotice(a.message);
        done = a.ok;
        setConfirm(false);
      } else setNotice(r.message);
      setDrafts((old) => [
        {
          ...d,
          history: old.find((x) => x.id === key)?.history,
          approved: done,
        },
        ...old.filter((x) => x.id !== key),
      ]);
    } catch {
      setNotice("Could not complete the request. Your draft is still here.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="growth">
      <header className="growth-cover">
        <div>
          <span className="growth-eyebrow">
            <Compass size={16} /> Creator workspace
          </span>
          <h1>
            Growth <i>Studio.</i>
          </h1>
          <p>Turn your next creative move into a working draft.</p>
        </div>
        <svg className="growth-dial" viewBox="0 0 220 220" aria-hidden="true">
          <g fill="none" stroke="currentColor">
            {[98, 82, 57, 29].map((r) => (
              <circle key={r} cx="110" cy="110" r={r} />
            ))}
            {Array.from({ length: 32 }, (_, i) => (
              <path
                key={i}
                d="M110 12v8"
                transform={`rotate(${i * 11.25} 110 110)`}
              />
            ))}
          </g>
          <path d="m154 49-31 77-57 45 31-77Z" fill="currentColor" />
          <circle cx="110" cy="110" r="5" fill="#223928" />
        </svg>
      </header>
      <nav aria-label="Growth Studio" className="growth-nav">
        {["Workbench", "Draft library", "Memory"].map((t) => (
          <button
            key={t}
            aria-current={tab === t ? "page" : undefined}
            onClick={() => select(t)}
          >
            {t}
          </button>
        ))}
        <small>
          {preview
            ? "Development preview"
            : offline
              ? "Storage unavailable"
              : provider
                ? "AI configured"
                : "Manual mode"}
        </small>
      </nav>
      {preview && (
        <p className="growth-note">
          Interactive preview · Changes last until you leave this page. AI
          generation is offline.
        </p>
      )}
      {initial.checkin && prefs.cadence !== "off" && (
        <p className="growth-note">
          Growth check-in: review your last draft and record one thing you
          learned.
        </p>
      )}
      {offline && (
        <p role="status">
          Private storage is unavailable. Saving and generation are paused.
        </p>
      )}
      {tab === "Workbench" ? (
        <div className="growth-columns">
          <aside>
            <h2>Choose a workflow</h2>
            {modes.map(([k, label, Icon]) => (
              <button
                key={k}
                className="growth-mode"
                aria-pressed={kind === k}
                disabled={busy || approved}
                onClick={() => {
                  setKind(k);
                  setConfirm(false);
                }}
              >
                <Icon size={18} />
                {label}
                <ArrowUpRight size={15} />
              </button>
            ))}
          </aside>
          <section>
            <h2>{modes.find((m) => m[0] === kind)?.[1]}</h2>
            {drafts.find((x) => x.id === id)?.history?.length ? (
              <details className="growth-history">
                <summary>Conversation history</summary>
                {drafts
                  .find((x) => x.id === id)
                  ?.history?.map((turn, i) => (
                    <section key={i}>
                      <h3>{turn.prompt}</h3>
                      <p>{turn.reply}</p>
                    </section>
                  ))}
              </details>
            ) : null}
            <fieldset disabled={busy || approved}>
              <label>
                {prompts[kind]}
                <textarea
                  maxLength={3000}
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="Start with your goal, audience or idea…"
                />
              </label>
              {!brief && (
                <div className="growth-starters" aria-label="Brief starters">
                  {{
                    Plan: [
                      "Build a weekly posting routine",
                      "Practice a new creative skill",
                    ],
                    Content: [
                      "Explore three hooks for my next post",
                      "Review my caption",
                    ],
                    Opportunity: [
                      "Check the deliverables in a brief",
                      "Prepare for a negotiation",
                    ],
                    Pitch: [
                      "Introduce my work to a brand",
                      "Refine an outreach message",
                    ],
                  }[kind].map((text) => (
                    <button key={text} onClick={() => setBrief(text)}>
                      {text} ↗
                    </button>
                  ))}
                </div>
              )}
              <div className="growth-options">
                {kind === "Plan" && (
                  <label>
                    Time horizon
                    <select
                      value={days}
                      onChange={(e) =>
                        setDays(Number(e.target.value) as Draft["days"])
                      }
                    >
                      {[7, 30, 90].map((n) => (
                        <option key={n} value={n}>
                          {n} days
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Draft language
                  <select
                    value={language}
                    onChange={(e) =>
                      setLanguage(e.target.value as Draft["language"])
                    }
                  >
                    {["English", "Hindi", "Hinglish"].map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Working draft
                <textarea
                  maxLength={8000}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write here or request a suggestion."
                />
              </label>
            </fieldset>
            <div className="growth-actions">
              {!approved && (
                <>
                  <button
                    disabled={busy || offline}
                    onClick={() => run("save")}
                  >
                    Save draft
                  </button>
                  <button
                    disabled={busy || !provider || offline}
                    onClick={() => run("generate")}
                  >
                    Generate suggestion
                  </button>
                  {body.trim() && (
                    <button
                      disabled={busy || offline}
                      onClick={() => setConfirm(true)}
                    >
                      Review idea
                    </button>
                  )}
                </>
              )}
              {approved && (
                <button onClick={() => open()}>Start another draft</button>
              )}
            </div>
            {!provider && !preview && (
              <small>AI is offline. Manual drafting is available.</small>
            )}
            {confirm && (
              <section className="growth-review">
                <h3>Add this idea to your library?</h3>
                <p>{brief.slice(0, 100)}</p>
                <blockquote>{body.slice(0, 1000)}</blockquote>
                <small>Your full draft stays in Growth Studio.</small>
                <div className="growth-actions">
                  <button disabled={busy} onClick={() => run("approve")}>
                    Approve and add idea
                  </button>
                  <button onClick={() => setConfirm(false)}>Cancel</button>
                </div>
              </section>
            )}
          </section>
        </div>
      ) : tab === "Draft library" ? (
        <section className="growth-pane">
          <h2>Draft library</h2>
          {drafts.length ? (
            drafts.map((d) => (
              <button className="growth-row" key={d.id} onClick={() => open(d)}>
                <span>{d.kind}</span>
                <strong>{d.brief}</strong>
                <small>{d.approved ? "Approved" : "Draft"}</small>
              </button>
            ))
          ) : (
            <p>
              <Lightbulb /> Your saved briefs and plans will appear here.
            </p>
          )}
          <button className="growth-mode" onClick={() => open()}>
            <Plus size={16} />
            New draft
          </button>
        </section>
      ) : (
        <section className="growth-pane">
          <h2>Personalization</h2>
          <label>
            <input
              type="checkbox"
              checked={prefs.enabled}
              onChange={(e) =>
                setPrefs({ ...prefs, enabled: e.target.checked })
              }
            />{" "}
            Use my goals and preferences in suggestions
          </label>
          <label>
            Style and preferences
            <textarea
              maxLength={2000}
              value={prefs.preferences}
              onChange={(e) =>
                setPrefs({ ...prefs, preferences: e.target.value })
              }
            />
          </label>
          <label>
            Private studio check-ins
            <select
              value={prefs.cadence ?? "off"}
              onChange={(e) =>
                setPrefs({
                  ...prefs,
                  cadence: e.target.value as Memory["cadence"],
                })
              }
            >
              <option value="off">Off</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          <div className="growth-actions">
            <button disabled={busy || offline} onClick={() => run("memory")}>
              Save preferences
            </button>
            <button disabled={busy || offline} onClick={() => setConfirm(true)}>
              Request deletion
            </button>
          </div>
          {confirm && (
            <div className="growth-actions">
              <button
                disabled={busy}
                onClick={() => {
                  setConfirm(false);
                  run("delete");
                }}
              >
                Confirm deletion request
              </button>
              <button onClick={() => setConfirm(false)}>Cancel</button>
            </div>
          )}
        </section>
      )}
      <p role="status" aria-live="polite">
        {busy ? "Working…" : notice}
      </p>
    </div>
  );
}
