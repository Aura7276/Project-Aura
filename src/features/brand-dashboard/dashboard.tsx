"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  Flag,
  Handshake,
  Layers,
  LayoutDashboard,
  LineChart,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Target,
} from "lucide-react";
import { BrandForm, type Edit } from "./form";
import {
  dateKey,
  defaultFocus,
  metrics,
  tracks,
  type Home,
  type Execute,
  type Command,
  type Task,
} from "./model";
import "./brand-dashboard.css";
const sections = [
  "Home",
  "Priorities",
  "Signals",
  "Collaborations",
  "Workspace",
] as const;
type Section = (typeof sections)[number];
const icons = [LayoutDashboard, Flag, LineChart, Handshake, Settings2];
function date(v: string) {
  return v
    ? new Date(v + "T12:00:00").toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      })
    : "No target date";
}
export function BrandDashboard({
  initial,
  execute,
  preview = false,
  offline = false,
}: {
  initial: Home;
  execute?: Execute;
  preview?: boolean;
  offline?: boolean;
}) {
  const [home, setHome] = useState(initial),
    [section, setSection] = useState<Section>("Home"),
    [edit, setEdit] = useState<Edit | null>(null),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [track, setTrack] = useState("All workstreams"),
    [showDone, setShowDone] = useState(false),
    [metric, setMetric] = useState<string>(metrics[0]),
    [channel, setChannel] = useState("");
  const current = useRef(initial);
  const writable =
    !offline &&
    home.workspace.status === "open" &&
    ["owner", "admin"].includes(home.workspace.role);
  const complete = home.tasks.filter((t) => t.done).length,
    open = home.tasks.filter((t) => !t.done);
  const tasks = home.tasks.filter(
    (t) =>
      (showDone || !t.done) &&
      (track === "All workstreams" || t.track === track) &&
      (t.title + " " + t.note).toLowerCase().includes(query.toLowerCase()),
  );
  const channels = Array.from(
    new Set(
      home.observations
        .filter((o) => o.metric === metric)
        .map((o) => o.channel),
    ),
  );
  const activeChannel = channels.includes(channel)
    ? channel
    : channels[0] || "";
  const observations = home.observations
    .filter((o) => o.metric === metric && o.channel === activeChannel)
    .sort((a, b) => a.date.localeCompare(b.date));
  const last = observations.at(-1);
  async function run(
    command: Command,
    request: string,
  ): Promise<string | null> {
    try {
      if (preview) {
        if (!["owner", "admin"].includes(current.current.workspace.role))
          return "This preview role has read-only access.";
        const next = structuredClone(current.current);
        switch (command.type) {
          case "focus":
            next.focus = {
              objective: command.objective,
              audience: command.audience,
              resources: command.resources,
              horizon: command.horizon,
            };
            break;
          case "task": {
            const old = next.tasks.find((t) => t.id === command.id);
            next.tasks = next.tasks.filter((t) => t.id !== command.id);
            next.tasks.push({
              ...command,
              done: old?.done || false,
              created_at: old?.created_at || new Date().toISOString(),
            });
            break;
          }
          case "complete": {
            const task = next.tasks.find((t) => t.id === command.id);
            if (!task) return "Priority unavailable.";
            task.done = command.done;
            break;
          }
          case "observation":
            if (command.date > dateKey())
              return "Use an actual observation date.";
            next.observations.push({ ...command, id: crypto.randomUUID() });
            break;
        }
        next.activity.unshift({
          id: crypto.randomUUID(),
          action: command.type,
          at: new Date().toISOString(),
        });
        next.revision++;
        current.current = next;
        setHome(next);
        setNotice("Preview updated. Changes are temporary.");
        return null;
      }
      if (!execute || !writable) return "Your workspace is read-only.";
      const result = await execute(command, request, current.current.revision);
      if (result.error) return result.error;
      if (!result.home) return "Your changes could not be saved.";
      current.current = result.home;
      setHome(result.home);
      setNotice("Saved to your private Brand workspace.");
      return null;
    } catch {
      return "Connection interrupted. Retry when connected.";
    }
  }
  async function toggle(task: Task) {
    setBusy(true);
    const problem = await run(
      { type: "complete", id: task.id, done: !task.done },
      crypto.randomUUID(),
    );
    if (problem) setNotice(problem);
    setBusy(false);
  }
  function scenario(value: string) {
    const next = structuredClone(initial);
    if (value === "new") {
      next.focus = defaultFocus;
      next.tasks = [];
      next.observations = [];
    }
    if (value === "member") next.workspace.role = "member";
    current.current = next;
    setHome(next);
    setNotice("");
    setSection("Home");
  }
  function taskRow(t: Task) {
    return (
      <div className={"bh-task " + (t.done ? "is-done" : "")} key={t.id}>
        <button
          className="bh-check"
          aria-label={(t.done ? "Reopen " : "Complete ") + t.title}
          aria-pressed={t.done}
          disabled={!writable || busy}
          onClick={() => void toggle(t)}
        >
          {t.done && <Check size={12} />}
        </button>
        <button
          className="bh-task-name"
          disabled={!writable}
          onClick={() => setEdit({ type: "task", task: t })}
        >
          <strong>{t.title}</strong>
          <small>{t.track}</small>
        </button>
        <span className="bh-date">{date(t.due)}</span>
        <ChevronRight size={15} />
      </div>
    );
  }
  return (
    <div className="bh">
      <aside className="bh-sidebar">
        <Link
          href={preview ? "/dev/brand-dashboard" : "/brand"}
          className="bh-logo"
        >
          aura<span>Brand Studio</span>
        </Link>
        <Link href="/workspaces" className="bh-workspace">
          <span className="bh-monogram">{home.workspace.name.slice(0, 1)}</span>
          <span>
            <strong>{home.workspace.name}</strong>
            <small>Brand workspace</small>
          </span>
          <ChevronDown size={13} />
        </Link>
        <nav aria-label="Brand workspace">
          {sections.map((s, i) => {
            const Icon = icons[i];
            return (
              <button
                key={s}
                aria-current={section === s ? "page" : undefined}
                onClick={() => setSection(s)}
              >
                <Icon size={17} />
                {s}
                {s === "Priorities" && open.length > 0 && (
                  <small>{open.length}</small>
                )}
              </button>
            );
          })}
        </nav>
        {!preview && (
          <nav aria-label="Business" className="bh-business">
            <Link href={`/brand?w=${home.workspace.id}`}>Setup and plans</Link>
            <Link href={`/brand/verification?w=${home.workspace.id}`}>
              Verification
            </Link>
            <Link href={`/brand/campaigns?w=${home.workspace.id}`}>
              Campaigns
            </Link>
            <Link href={`/brand/inbox?w=${home.workspace.id}`}>Inbox</Link>
          </nav>
        )}
        <div className="bh-sidebar-bottom">
          <div className="bh-guide">
            <BookOpen />
            <h3>
              A little direction
              <br />
              goes a long way.
            </h3>
            <Link href="/resources">
              Explore Brand resources
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <Link href="/workspaces">
            <Settings2 size={16} />
            Manage workspaces
          </Link>
        </div>
      </aside>
      <div className="bh-body">
        <header className="bh-top">
          <span>
            Workspace
            <ChevronRight size={12} />
            <strong>{section}</strong>
          </span>
          <div>
            <ShieldCheck size={14} />
            <span>Private by default</span>
            <Link
              href="/workspaces"
              aria-label="Switch workspace"
              className="bh-avatar"
            >
              {home.workspace.name.slice(0, 1)}
            </Link>
          </div>
        </header>
        {preview && (
          <div className="bh-preview">
            <span>
              Development preview · fictional Brand · temporary changes
            </span>
            <label>
              Scenario
              <select
                defaultValue="working"
                onChange={(e) => scenario(e.target.value)}
              >
                <option value="working">Working plan</option>
                <option value="new">New Brand</option>
                <option value="member">Read-only member</option>
              </select>
            </label>
          </div>
        )}
        <div className="bh-main">
          {offline && (
            <p className="bh-alert" role="alert">
              Planning data is unavailable. Reconnect to load this workspace.
            </p>
          )}
          <p className="bh-notice" role="status">
            {notice}
          </p>
          {section === "Home" && (
            <>
              <div className="bh-page-heading">
                <div>
                  <p>{home.workspace.name}</p>
                  <h1>A clearer path forward.</h1>
                  <span>Build your presence. Shape your next move.</span>
                </div>
                <button
                  className="bh-primary"
                  disabled={!writable}
                  onClick={() => setEdit({ type: "task" })}
                >
                  <Plus />
                  Add priority
                </button>
              </div>
              <div className="bh-home-grid">
                <section className="bh-focus">
                  <div className="bh-focus-top">
                    <span>
                      <Compass size={17} />
                      Your direction
                    </span>
                    <button
                      disabled={!writable}
                      onClick={() => setEdit({ type: "focus" })}
                    >
                      {home.focus.objective ? "Edit focus" : "Set focus"}
                      <ArrowUpRight size={13} />
                    </button>
                  </div>
                  <h2>
                    {home.focus.objective ||
                      "Start with one meaningful objective."}
                  </h2>
                  <p>
                    {home.focus.audience ||
                      "Define who you want to reach and what you want to achieve. Your plan can begin before your first social account."}
                  </p>
                  <footer>
                    <span className="bh-horizon">
                      {home.focus.horizon}-day horizon
                    </span>
                    <span>
                      {complete} of {home.tasks.length} priorities complete
                    </span>
                  </footer>
                  <div
                    className="bh-focus-progress"
                    role="progressbar"
                    aria-label="Completed priorities"
                    aria-valuemin={0}
                    aria-valuemax={home.tasks.length || 1}
                    aria-valuenow={complete}
                  >
                    <span
                      style={{
                        width:
                          (home.tasks.length
                            ? (complete / home.tasks.length) * 100
                            : 0) + "%",
                      }}
                    />
                  </div>
                </section>
                <section className="bh-start">
                  <span className="bh-mini-label">
                    Make room for the right work
                  </span>
                  <h2>
                    Small steps.
                    <br />
                    Clear direction.
                  </h2>
                  <div>
                    <Target />
                    <p>
                      {home.focus.objective
                        ? "Turn your objective into a specific action."
                        : "Choose one objective for your planning horizon."}
                    </p>
                  </div>
                  <div>
                    <Layers />
                    <p>
                      {home.focus.resources
                        ? "Plan around the resources you already have."
                        : "Add your audience and available resources."}
                    </p>
                  </div>
                  <button
                    className="bh-text-button"
                    disabled={!writable}
                    onClick={() =>
                      setEdit({ type: home.focus.objective ? "task" : "focus" })
                    }
                  >
                    {home.focus.objective
                      ? "Create your next priority"
                      : "Shape your direction"}
                    <ArrowRight />
                  </button>
                </section>
              </div>
              <div className="bh-lower-grid">
                <section>
                  <div className="bh-section-heading">
                    <h2>On your radar</h2>
                    <button
                      className="bh-text-button"
                      onClick={() => setSection("Priorities")}
                    >
                      View plan
                      <ArrowRight />
                    </button>
                  </div>
                  <div className="bh-task-list">
                    {open.slice(0, 4).map(taskRow)}
                    {!open.length && (
                      <Empty
                        title={
                          home.tasks.length
                            ? "A little breathing room."
                            : "Your first priority starts here."
                        }
                        body={
                          home.tasks.length
                            ? "Your current priorities are complete. Choose the next step when you are ready."
                            : "Capture a practical next step for your content, Creator marketing or business."
                        }
                      />
                    )}
                  </div>
                  <div className="bh-workstreams">
                    {tracks.map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setTrack(t);
                          setSection("Priorities");
                        }}
                      >
                        <span
                          className={
                            "bh-track-dot " +
                            (t === "Creator marketing"
                              ? "violet"
                              : t === "Business"
                                ? "peach"
                                : "")
                          }
                        />
                        <span>{t}</span>
                        <small>
                          {
                            home.tasks.filter(
                              (task) => task.track === t && !task.done,
                            ).length
                          }{" "}
                          open
                        </small>
                      </button>
                    ))}
                  </div>
                </section>
                <section className="bh-signal-card">
                  <div className="bh-section-heading">
                    <span>
                      <LineChart size={17} />
                      Your signals
                    </span>
                    <button
                      aria-label="Open signals"
                      className="bh-text-button"
                      onClick={() => setSection("Signals")}
                    >
                      <ArrowUpRight />
                    </button>
                  </div>
                  {home.observations.length ? (
                    <>
                      <h2>{home.observations.length} observations</h2>
                      <p>
                        Manual records with dates and sources. Explore each
                        channel in Signals.
                      </p>
                      <button onClick={() => setSection("Signals")}>
                        Review observations
                        <ArrowRight />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="bh-empty-chart" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                        <span />
                        <div>
                          <LineChart />
                        </div>
                      </div>
                      <h3>See where you are starting.</h3>
                      <p>
                        Record an observation from a social account, website or
                        customer enquiry source.
                      </p>
                      <button
                        disabled={!writable}
                        onClick={() => setEdit({ type: "observation" })}
                      >
                        Add your first observation
                      </button>
                    </>
                  )}
                </section>
              </div>
              <div className="bh-verification">
                <ShieldCheck />
                <div>
                  <strong>
                    {home.workspace.verification === "verified"
                      ? "Business verification recorded"
                      : "Keep planning while verification is pending"}
                  </strong>
                  <p>
                    {home.workspace.verification === "verified"
                      ? "Commercial actions still follow the permissions and readiness of each tool."
                      : "Private priorities and observations are available. Campaign publication and commercial outreach require approved verification."}
                  </p>
                </div>
                <button
                  className="bh-text-button"
                  onClick={() => setSection("Workspace")}
                >
                  Workspace details
                  <ChevronRight />
                </button>
              </div>
            </>
          )}
          {section === "Priorities" && (
            <>
              <div className="bh-page-heading">
                <div>
                  <p>Your marketing plan</p>
                  <h1>Make the next move.</h1>
                  <span>
                    {home.focus.objective ||
                      "A private plan built around your Brand."}
                  </span>
                </div>
                <button
                  disabled={!writable}
                  className="bh-primary"
                  onClick={() => setEdit({ type: "task" })}
                >
                  <Plus />
                  Add priority
                </button>
              </div>
              <div className="bh-filters">
                <label>
                  <Search size={16} />
                  <input
                    aria-label="Search priorities"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search your priorities"
                  />
                </label>
                <select
                  aria-label="Workstream"
                  value={track}
                  onChange={(e) => setTrack(e.target.value)}
                >
                  {["All workstreams", ...tracks].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <label className="bh-show-done">
                  <input
                    type="checkbox"
                    checked={showDone}
                    onChange={(e) => setShowDone(e.target.checked)}
                  />
                  Show completed
                </label>
              </div>
              <div className="bh-task-list">
                {tasks.map(taskRow)}
                {!tasks.length && (
                  <Empty
                    title="Room for what comes next."
                    body="Add a priority or adjust the current filters."
                  />
                )}
              </div>
              <details className="bh-context">
                <summary>Planning context</summary>
                <h3>Audience</h3>
                <p>{home.focus.audience || "No audience context recorded."}</p>
                <h3>Resources</h3>
                <p>{home.focus.resources || "No resources recorded."}</p>
                <button
                  disabled={!writable}
                  onClick={() => setEdit({ type: "focus" })}
                >
                  Edit planning focus
                </button>
              </details>
            </>
          )}
          {section === "Signals" && (
            <>
              <div className="bh-page-heading">
                <div>
                  <p>Manual observations</p>
                  <h1>Know your starting point.</h1>
                  <span>Actual values, with the context behind them.</span>
                </div>
                <button
                  disabled={!writable}
                  className="bh-primary"
                  onClick={() => setEdit({ type: "observation" })}
                >
                  <Plus />
                  Add observation
                </button>
              </div>
              <div className="bh-filters">
                <select
                  aria-label="Metric"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                >
                  {metrics.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <select
                  aria-label="Channel"
                  value={activeChannel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  {channels.length ? (
                    channels.map((c) => <option key={c}>{c}</option>)
                  ) : (
                    <option value="">No recorded channels</option>
                  )}
                </select>
              </div>
              {last ? (
                <>
                  <div className="bh-latest">
                    <span>
                      {metric} · {activeChannel}
                    </span>
                    <strong>{last.value.toLocaleString("en-IN")}</strong>
                    <small>
                      Observed {date(last.date)} · {last.source} · manual entry
                    </small>
                  </div>
                  <div className="bh-observation-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Value</th>
                          <th>Source</th>
                          <th>Context</th>
                        </tr>
                      </thead>
                      <tbody>
                        {observations.map((o) => (
                          <tr key={o.id}>
                            <td>{date(o.date)}</td>
                            <td>{o.value.toLocaleString("en-IN")}</td>
                            <td>{o.source}</td>
                            <td>{o.note || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <Empty
                  title="Every Brand has a starting point."
                  body="Add a sourced observation when you have one. Your private planning tools are ready now."
                />
              )}
            </>
          )}
          {section === "Collaborations" && (
            <>
              <div className="bh-page-heading">
                <div>
                  <p>Creator partnerships</p>
                  <h1>Better, together.</h1>
                  <span>Your authorized collaboration workspaces.</span>
                </div>
                <Link className="bh-link-button" href="/explore/creators">
                  Browse public Creators
                  <ArrowUpRight size={15} />
                </Link>
              </div>
              {!home.collaborationsAvailable ? (
                <Empty
                  title="Collaboration data is unavailable."
                  body="Return when the connection is restored."
                />
              ) : home.collaborations.length ? (
                <div className="bh-project-grid">
                  {home.collaborations.map((c) => (
                    <Link href={"/collaborations/" + c.id} key={c.id}>
                      <span className="bh-status">{c.status}</span>
                      <h2>{c.title}</h2>
                      <p>
                        {c.creator} · {c.category}
                      </p>
                      <footer>
                        Open shared workspace
                        <ArrowUpRight size={16} />
                      </footer>
                    </Link>
                  ))}
                </div>
              ) : (
                <Empty
                  title="The right partnership starts with clarity."
                  body="Define your audience, creative direction and delivery needs in your private plan. Confirmed collaborations will appear here."
                />
              )}
              <div className="bh-module-note">
                <Handshake />
                <div>
                  <h3>Campaign planning and discovery</h3>
                  <p>
                    Advanced Creator discovery and campaign operations are being
                    prepared. Your private planning priorities are available
                    now.
                  </p>
                </div>
                <button
                  disabled={!writable}
                  onClick={() => setEdit({ type: "task" })}
                >
                  Add planning priority
                </button>
              </div>
            </>
          )}
          {section === "Workspace" && (
            <>
              <div className="bh-page-heading">
                <div>
                  <p>Workspace context</p>
                  <h1>{home.workspace.name}</h1>
                  <span>
                    Independent access, private planning and clear ownership.
                  </span>
                </div>
                <Link className="bh-link-button" href="/workspaces">
                  Switch workspace
                  <ArrowUpRight size={15} />
                </Link>
              </div>
              <dl className="bh-facts">
                {[
                  ["Your role", home.workspace.role],
                  ["Workspace status", home.workspace.status],
                  ["Business verification", home.workspace.verification],
                  ["Planning horizon", home.focus.horizon + " days"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <section className="bh-context">
                <h2>Brand planning focus</h2>
                <p>
                  {home.focus.objective ||
                    "Choose a primary objective to personalize this workspace."}
                </p>
                <button
                  disabled={!writable}
                  onClick={() => setEdit({ type: "focus" })}
                >
                  Edit focus
                </button>
              </section>
              <div className="bh-section-heading">
                <h2>Recent activity</h2>
              </div>
              <ol className="bh-activity">
                {home.activity.slice(0, 20).map((a) => (
                  <li key={a.id}>
                    <span className="bh-track-dot" />
                    <div>
                      <strong>
                        {{
                          focus: "Planning focus updated",
                          task: "Priority saved",
                          complete: "Priority status updated",
                          observation: "Observation recorded",
                        }[a.action] || a.action}
                      </strong>
                      <small>{new Date(a.at).toLocaleString("en-IN")}</small>
                    </div>
                  </li>
                ))}
              </ol>
              {!home.activity.length && (
                <p className="bh-muted">
                  Your workspace updates will appear here.
                </p>
              )}
            </>
          )}
        </div>
      </div>
      {edit && (
        <BrandForm
          edit={edit}
          home={home}
          close={() => setEdit(null)}
          run={run}
        />
      )}
    </div>
  );
}
function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="bh-empty">
      <Compass />
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
