import Link from "next/link";
import { notFound } from "next/navigation";
import { brandContext } from "@/server/market/service";
import {
  brandContent,
  type Detail,
  type Item,
  type Overview,
  type Stage,
} from "@/server/brand-content/service";
import { EntityForm, type FieldDef } from "@/features/creator-profile/forms";
import * as act from "./actions";
import {
  assetKinds,
  boardStages,
  calendarDate,
  checklistLabels,
  formatLabels,
  handle,
  mixGap,
  monthGrid,
  monthOf,
  nextStep,
  platformLabels,
  provenanceLabels,
  resultSources,
  rightsText,
  shiftMonth,
  sourceLabels,
  stageLabels,
} from "./rules";
import "./content.css";

type SP = Record<string, string | string[] | undefined>;
const one = (sp: SP, k: string) =>
  typeof sp[k] === "string" ? (sp[k] as string) : undefined;
const uuidRe = /^[0-9a-f-]{36}$/i;
const day = (iso?: string | null) =>
  iso
    ? new Date(
        iso + (iso.length === 10 ? "T00:00:00Z" : ""),
      ).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
const num = (n: number) => new Intl.NumberFormat("en-IN").format(n);
const today = () => new Date().toISOString().slice(0, 10);
const W = (w: string): FieldDef => ({
  name: "w",
  label: "",
  type: "hidden",
  value: w,
});
const H = (name: string, value: string | number): FieldDef => ({
  name,
  label: "",
  type: "hidden",
  value,
});
const opts = <T extends { id: string }>(
  xs: T[],
  label: (x: T) => string,
  none: string,
) => ({ "": none, ...Object.fromEntries(xs.map((x) => [x.id, label(x)])) });

type Tab = "overview" | "board" | "calendar" | "pillars" | "reuse" | "learning";
const tabs: [Tab, string, string][] = [
  ["overview", "Overview", "/brand/content"],
  ["board", "Production board", "/brand/content/board"],
  ["calendar", "Calendar", "/brand/content/calendar"],
  ["pillars", "Pillars", "/brand/content/pillars"],
  ["reuse", "Creator content", "/brand/content/reuse"],
  ["learning", "Performance", "/brand/content/learning"],
];
function Shell({
  w,
  current,
  title,
  lead,
  children,
  action,
}: {
  w: string;
  current: Tab;
  title: string;
  lead: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <main className="shell bc-main">
      <header className="bc-head">
        <div>
          <p className="bc-eyebrow">Content and social</p>
          <h1>{title}</h1>
          <p className="st-hint">{lead}</p>
        </div>
        {action}
      </header>
      <nav className="bc-tabs" aria-label="Content">
        {tabs.map(([k, label, href]) => (
          <Link
            key={k}
            href={`${href}?w=${w}`}
            aria-current={k === current ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </main>
  );
}
function Flash({ sp }: { sp: SP }) {
  const e = one(sp, "error");
  const m = one(sp, "moved");
  if (e)
    return (
      <p className="st-error bc-flash" role="alert">
        {e.slice(0, 200)}
      </p>
    );
  if (m && m in stageLabels)
    return (
      <p className="st-ok bc-flash" role="status">
        Moved to {stageLabels[m as Stage]}.
      </p>
    );
  return null;
}
function Chip({ stage }: { stage: Stage }) {
  return <span className={"bc-stage s-" + stage}>{stageLabels[stage]}</span>;
}
function Card({ i, w }: { i: Item; w: string }) {
  return (
    <li className="bc-card">
      <div className="bc-card-top">
        <span className="bc-format">{formatLabels[i.format]}</span>
        {i.source !== "team" && (
          <span className={"bc-src " + i.source}>{sourceLabels[i.source]}</span>
        )}
        {i.unapproved_claims.length > 0 && i.stage !== "published" && (
          <span className="bc-flag">Claim to check</span>
        )}
      </div>
      <Link href={`/brand/content/${i.id}?w=${w}`} className="bc-card-title">
        {i.title}
      </Link>
      <p className="bc-meta">
        {handle(i.account)}
        {i.pillar && <> · {i.pillar}</>}
      </p>
      <p className="bc-meta">
        {calendarDate(i)
          ? (i.published_on ? "Live " : "Planned ") + day(calendarDate(i))
          : "No date yet"}
      </p>
      <p className="bc-next">{nextStep(i)}</p>
    </li>
  );
}
function NoAccounts({
  w,
  accounts,
}: {
  w: string;
  accounts: Overview["accounts"];
}) {
  if (accounts.length) return null;
  return (
    <p className="bc-note" role="note">
      Add your Brand&apos;s social accounts in{" "}
      <Link href={`/brand/socials?w=${w}`}>Business → Social accounts</Link> to
      plan posts for them. AURA does not connect to or post on your accounts;
      your team posts and records the link.
    </p>
  );
}
function IdeaForm({ o, w, open }: { o: Overview; w: string; open?: boolean }) {
  return (
    <EntityForm
      action={act.createIdea}
      label="Add an idea"
      idPrefix="bc-idea"
      submit={open ? "Create and open" : "Add idea"}
      fields={[
        W(w),
        ...(open ? [H("open", "1")] : []),
        {
          name: "title",
          label: "Idea",
          max: 140,
          required: true,
          hint: "One line. You can add the hook, script and caption later.",
        },
        {
          name: "format",
          label: "Format",
          type: "select",
          options: formatLabels,
          value: "reel",
          required: true,
        },
        ...(o.pillars.length
          ? [
              {
                name: "pillar_id",
                label: "Pillar",
                type: "select" as const,
                options: opts(o.pillars, (p) => p.name, "No pillar"),
              },
            ]
          : []),
        ...(o.accounts.length
          ? [
              {
                name: "account_id",
                label: "Account",
                type: "select" as const,
                options: opts(o.accounts, (a) => handle(a), "Decide later"),
              },
            ]
          : []),
        { name: "planned_for", label: "Planned for", type: "date" },
      ]}
    />
  );
}

// ───────── Overview ─────────
export async function ContentHome({ sp }: { sp: SP }) {
  const b = await brandContext(one(sp, "w"));
  const w = b.workspaceId;
  const r = await brandContent.overview(b.client, w);
  if (!r.ok) notFound();
  const o = r.value;
  const inMonth = (d: string | null) =>
    !!d && d >= o.period.from && d <= o.period.to;
  const review = o.items.filter((i) => i.stage === "in_review");
  const upcoming = o.items
    .filter(
      (i) =>
        ["approved", "scheduled"].includes(i.stage) &&
        i.planned_for &&
        i.planned_for >= today(),
    )
    .sort((a, b) => (a.planned_for ?? "").localeCompare(b.planned_for ?? ""))
    .slice(0, 6);
  const overdue = o.items.filter(
    (i) =>
      ["approved", "scheduled"].includes(i.stage) &&
      i.planned_for &&
      i.planned_for < today(),
  );
  const working = o.items.filter((i) =>
    ["drafting", "production"].includes(i.stage),
  ).length;
  const live = o.items.filter(
    (i) => i.stage === "published" && inMonth(i.published_on),
  ).length;
  const gaps = mixGap(o.pillars, o.items);
  return (
    <Shell
      w={w}
      current="overview"
      title="Content"
      lead="Plan, write, approve and publish your Brand's own content, alongside your Creator campaigns."
    >
      <NoAccounts w={w} accounts={o.accounts} />
      <div className="bc-kpis">
        <div>
          <b>{o.items.filter((i) => i.stage === "idea").length}</b>ideas
        </div>
        <div>
          <b>{working}</b>being made
        </div>
        <div className={review.length ? "warn" : ""}>
          <b>{review.length}</b>waiting for review
        </div>
        <div>
          <b>{o.items.filter((i) => i.stage === "scheduled").length}</b>
          scheduled
        </div>
        <div>
          <b>{live}</b>published this month
        </div>
      </div>
      <div className="bc-grid">
        <section className="st-card" aria-labelledby="h-review">
          <h2 id="h-review">Needs your review</h2>
          {review.length ? (
            <ul className="bc-list">
              {review.map((i) => (
                <li key={i.id}>
                  <Link href={`/brand/content/${i.id}?w=${w}#review`}>
                    {i.title}
                  </Link>
                  <span className="st-hint">
                    v{i.version} · {handle(i.account)}
                  </span>
                  {i.unapproved_claims.length > 0 && (
                    <span className="bc-flag">Claim to check</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="st-hint">
              Nothing waiting. Content appears here when someone sends it for
              review.
            </p>
          )}
          {overdue.length > 0 && (
            <>
              <h3 className="bc-sub">Past its date</h3>
              <ul className="bc-list">
                {overdue.map((i) => (
                  <li key={i.id}>
                    <Link href={`/brand/content/${i.id}?w=${w}`}>
                      {i.title}
                    </Link>
                    <span className="st-hint">
                      Planned {day(i.planned_for)}. Post it and record the link,
                      or move the date.
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section className="st-card" aria-labelledby="h-up">
          <h2 id="h-up">Coming up</h2>
          {upcoming.length ? (
            <ul className="bc-list">
              {upcoming.map((i) => (
                <li key={i.id}>
                  <span className="bc-date">{day(i.planned_for)}</span>
                  <Link href={`/brand/content/${i.id}?w=${w}`}>{i.title}</Link>
                  <Chip stage={i.stage} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="st-hint">Nothing approved with a date yet.</p>
          )}
          <p>
            <Link href={`/brand/content/calendar?w=${w}`}>
              Open the calendar
            </Link>
          </p>
        </section>
        <section className="st-card" aria-labelledby="h-add">
          <h2 id="h-add">Capture an idea</h2>
          <IdeaForm o={o} w={w} />
          <p className="st-hint">
            Want suggestions? Ask the{" "}
            <Link href={`/brand/assistant?w=${w}`}>Assistant</Link> for content
            ideas; approved ideas land here.
          </p>
        </section>
        <section className="st-card" aria-labelledby="h-mix">
          <h2 id="h-mix">Content mix</h2>
          {gaps.length ? (
            <ul className="bc-mix">
              {gaps.map((g) => (
                <li key={g.id}>
                  <div className="bc-mix-top">
                    <span>{g.name}</span>
                    <span className="st-hint">
                      {g.share}% planned · target {g.target}%
                    </span>
                  </div>
                  <div className="bc-mix-bar" aria-hidden="true">
                    <span className="t" style={{ width: g.target + "%" }} />
                    <span className="p" style={{ width: g.share + "%" }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="st-hint">
              Set up <Link href={`/brand/content/pillars?w=${w}`}>pillars</Link>
              , the themes you post about, and a target mix.
            </p>
          )}
          <p className="st-hint">
            Share of active content with a pillar. A plan, not a result.
          </p>
        </section>
      </div>
    </Shell>
  );
}

// ───────── Board ─────────
export async function BoardView({ sp }: { sp: SP }) {
  const b = await brandContext(one(sp, "w"));
  const w = b.workspaceId;
  const r = await brandContent.overview(b.client, w);
  if (!r.ok) notFound();
  const o = r.value;
  return (
    <Shell
      w={w}
      current="board"
      title="Production board"
      lead="Every piece of content by stage. Approval is for one version; changing it sends it back to review."
    >
      <Flash sp={sp} />
      <div className="bc-board">
        {boardStages.map((s) => {
          const items = o.items.filter((i) => i.stage === s);
          return (
            <section key={s} className="bc-col" aria-labelledby={"col-" + s}>
              <h2 id={"col-" + s}>
                {stageLabels[s]}{" "}
                <span className="bc-count">{items.length}</span>
              </h2>
              {items.length ? (
                <ul className="bc-cards">
                  {items.map((i) => (
                    <Card key={i.id} i={i} w={w} />
                  ))}
                </ul>
              ) : (
                <p className="st-hint bc-empty">Empty</p>
              )}
            </section>
          );
        })}
      </div>
      {o.archived > 0 && (
        <p className="st-hint">
          {o.archived} archived item(s) are kept off the board.
        </p>
      )}
      <section className="st-card bc-narrow" aria-labelledby="h-new">
        <h2 id="h-new">New content</h2>
        <IdeaForm o={o} w={w} open />
      </section>
    </Shell>
  );
}

// ───────── Calendar ─────────
export async function CalendarView({ sp }: { sp: SP }) {
  const b = await brandContext(one(sp, "w"));
  const w = b.workspaceId;
  const month = monthOf(one(sp, "m"));
  const r = await brandContent.overview(b.client, w);
  if (!r.ok) notFound();
  const o = r.value;
  const grid = monthGrid(month);
  const byDay = new Map<string, Item[]>();
  for (const i of o.items) {
    const d = calendarDate(i);
    if (d) byDay.set(d, [...(byDay.get(d) ?? []), i]);
  }
  const undated = o.items.filter(
    (i) => !calendarDate(i) && i.stage !== "published",
  );
  const label = new Date(month + "-01T00:00:00Z").toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const t0 = today();
  return (
    <Shell
      w={w}
      current="calendar"
      title="Calendar"
      lead="Planned and published content by day. Your team posts; AURA keeps the plan and the record."
    >
      <div className="bc-cal-head">
        <Link
          href={`/brand/content/calendar?w=${w}&m=${shiftMonth(month, -1)}`}
          aria-label="Previous month"
        >
          ←
        </Link>
        <h2>{label}</h2>
        <Link
          href={`/brand/content/calendar?w=${w}&m=${shiftMonth(month, 1)}`}
          aria-label="Next month"
        >
          →
        </Link>
      </div>
      <div
        className="bc-cal"
        role="table"
        aria-label={`Content calendar, ${label}`}
      >
        <div role="row" className="bc-cal-row bc-cal-dow">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <span role="columnheader" key={d}>
              {d}
            </span>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, wk) => (
          <div role="row" className="bc-cal-row" key={wk}>
            {grid.slice(wk * 7, wk * 7 + 7).map((d) => (
              <div
                role="cell"
                key={d.iso}
                className={
                  "bc-day" +
                  (d.inMonth ? "" : " out") +
                  (d.iso === t0 ? " today" : "")
                }
              >
                <span className="bc-day-n">{d.day}</span>
                {(byDay.get(d.iso) ?? []).map((i) => (
                  <Link
                    key={i.id}
                    href={`/brand/content/${i.id}?w=${w}`}
                    className={"bc-pill s-" + i.stage}
                    title={`${i.title} · ${stageLabels[i.stage]}`}
                  >
                    {i.account
                      ? (platformLabels[i.account.platform] ?? "").slice(0, 2) +
                        " · "
                      : ""}
                    {i.title}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      <ul className="bc-legend" aria-label="Legend">
        {(
          [
            "drafting",
            "in_review",
            "approved",
            "scheduled",
            "published",
          ] as Stage[]
        ).map((s) => (
          <li key={s}>
            <span className={"bc-dot s-" + s} /> {stageLabels[s]}
          </li>
        ))}
      </ul>
      {undated.length > 0 && (
        <section className="st-card" aria-labelledby="h-undated">
          <h2 id="h-undated">Not on the calendar yet ({undated.length})</h2>
          <ul className="bc-list">
            {undated.map((i) => (
              <li key={i.id}>
                <Link href={`/brand/content/${i.id}?w=${w}`}>{i.title}</Link>{" "}
                <Chip stage={i.stage} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </Shell>
  );
}

// ───────── Pillars ─────────
export async function PillarsView({ sp }: { sp: SP }) {
  const b = await brandContext(one(sp, "w"));
  const w = b.workspaceId;
  const r = await brandContent.overview(b.client, w);
  if (!r.ok) notFound();
  const o = r.value;
  const total = o.pillars.reduce((s, p) => s + p.mix, 0);
  return (
    <Shell
      w={w}
      current="pillars"
      title="Pillars"
      lead="The themes your Brand posts about, and how much of your content each should take."
    >
      <div className="bc-grid">
        <section className="st-card" aria-labelledby="h-pl">
          <h2 id="h-pl">Your pillars</h2>
          <p className="st-hint">Target mix: {total}% of 100% assigned.</p>
          {o.pillars.length ? (
            o.pillars.map((p) => (
              <details key={p.id} className="bc-pillar">
                <summary>
                  <b>{p.name}</b>{" "}
                  <span className="st-hint">
                    {p.mix}% · {p.published} published
                  </span>
                </summary>
                <EntityForm
                  action={act.savePillar}
                  label={`Edit ${p.name}`}
                  idPrefix={"pl-" + p.id.slice(0, 8)}
                  submit="Save pillar"
                  fields={[
                    W(w),
                    H("id", p.id),
                    {
                      name: "name",
                      label: "Name",
                      value: p.name,
                      required: true,
                      max: 60,
                    },
                    {
                      name: "description",
                      label: "What it covers",
                      type: "textarea",
                      rows: 2,
                      value: p.description ?? "",
                      max: 500,
                    },
                    {
                      name: "mix",
                      label: "Target share (%)",
                      type: "number",
                      min: 0,
                      max: 100,
                      value: p.mix,
                      required: true,
                    },
                    {
                      name: "archived",
                      label: "Archive this pillar",
                      type: "checkbox",
                    },
                  ]}
                />
              </details>
            ))
          ) : (
            <p className="st-hint">No pillars yet.</p>
          )}
        </section>
        <section className="st-card" aria-labelledby="h-plnew">
          <h2 id="h-plnew">Add a pillar</h2>
          <EntityForm
            action={act.savePillar}
            label="Add a pillar"
            idPrefix="pl-new"
            submit="Add pillar"
            fields={[
              W(w),
              {
                name: "name",
                label: "Name",
                required: true,
                max: 60,
                hint: "For example: Behind the scenes, Guest stories, How-to.",
              },
              {
                name: "description",
                label: "What it covers",
                type: "textarea",
                rows: 2,
                max: 500,
              },
              {
                name: "mix",
                label: "Target share (%)",
                type: "number",
                min: 0,
                max: 100,
                value: Math.max(0, 100 - total),
                required: true,
              },
            ]}
          />
          {o.guidelines && (
            <div className="bc-guide">
              <h3 className="bc-sub">From your Brand guidelines</h3>
              {o.guidelines.voice && <p>Voice: {o.guidelines.voice}</p>}
              {!!o.guidelines.tone?.length && (
                <p>Tone: {o.guidelines.tone.join(", ")}</p>
              )}
              {!!o.guidelines.donts?.length && (
                <p>Avoid: {o.guidelines.donts.join("; ")}</p>
              )}
              <p>
                <Link href={`/brand/guidelines?w=${w}`}>Edit guidelines</Link>
              </p>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}

// ───────── Reusing Creator content ─────────
export async function ReuseView({ sp }: { sp: SP }) {
  const b = await brandContext(one(sp, "w"));
  const w = b.workspaceId;
  const [r, s] = await Promise.all([
    brandContent.overview(b.client, w),
    brandContent.sources(b.client, w),
  ]);
  if (!r.ok || !s.ok) notFound();
  const o = r.value;
  const sources = s.value;
  const usable = sources.filter((x) => x.accounts.some((a) => a.check.allowed));
  return (
    <Shell
      w={w}
      current="reuse"
      title="Creator content"
      lead="Published work from your Creator collaborations, and where the agreed rights let you reuse it."
    >
      <NoAccounts w={w} accounts={o.accounts} />
      {sources.length === 0 ? (
        <div className="bc-empty-big">
          <h2>No published Creator work yet</h2>
          <p>
            When a Creator publishes a deliverable in a collaboration, it
            appears here with the usage rights you agreed.
          </p>
          <Link href={`/brand/campaigns?w=${w}`}>Go to campaigns</Link>
        </div>
      ) : (
        <div className="bc-grid">
          <section className="st-card bc-span" aria-labelledby="h-src">
            <h2 id="h-src">Published Creator work</h2>
            <ul className="bc-sources">
              {sources.map((x) => (
                <li key={x.collaboration_id + x.deliverable_id}>
                  <div>
                    <b>{x.title}</b>{" "}
                    <span className="st-hint">by {x.creator}</span>
                    <p className="st-hint">
                      {x.campaign ?? "Campaign"} · live {day(x.published_on)}
                      {x.url && (
                        <>
                          {" · "}
                          <a
                            href={x.url}
                            rel="noopener noreferrer nofollow"
                            target="_blank"
                          >
                            View original
                          </a>
                        </>
                      )}
                    </p>
                    <p>Agreed rights: {rightsText(x.rights)}</p>
                  </div>
                  <ul className="bc-rights">
                    {x.accounts.map((a) => (
                      <li key={a.id} className={a.check.allowed ? "ok" : "no"}>
                        <b>{handle(a)}</b> {a.check.allowed ? "✓ " : "✕ "}
                        {a.check.reason}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
          <section className="st-card" aria-labelledby="h-reuse">
            <h2 id="h-reuse">Reuse on your account</h2>
            {usable.length ? (
              <EntityForm
                action={act.repurpose}
                label="Reuse Creator content"
                idPrefix="bc-reuse"
                submit="Create a draft"
                fields={[
                  W(w),
                  {
                    name: "source",
                    label: "Creator content",
                    type: "select",
                    required: true,
                    options: Object.fromEntries(
                      usable.map((x) => [
                        `${x.collaboration_id}|${x.deliverable_id}`,
                        `${x.title} by ${x.creator}`,
                      ]),
                    ),
                  },
                  {
                    name: "account_id",
                    label: "Your account",
                    type: "select",
                    required: true,
                    options: opts(
                      o.accounts,
                      (a) => handle(a),
                      "Choose an account",
                    ),
                  },
                  {
                    name: "planned_for",
                    label: "Planned for",
                    type: "date",
                    hint: "Checked against the end of the agreed rights.",
                  },
                ]}
              />
            ) : (
              <p className="st-hint">
                None of the published work can be reused on your accounts under
                the agreed rights.
              </p>
            )}
            <p className="st-hint">
              Reuse is checked again when you mark the post published. A
              disclosure and Creator credit are part of the checklist.
            </p>
          </section>
        </div>
      )}
    </Shell>
  );
}

// ───────── Performance and learning ─────────
export async function LearningView({ sp }: { sp: SP }) {
  const b = await brandContext(one(sp, "w"));
  const w = b.workspaceId;
  const r = await brandContent.learning(b.client, w);
  if (!r.ok) notFound();
  const l = r.value;
  const metricKeys = Object.keys(l.by_metric);
  const lbl = (k: string) => l.metrics[k]?.label ?? k;
  return (
    <Shell
      w={w}
      current="learning"
      title="Performance"
      lead="What your published content achieved, from the figures your team recorded. No estimates."
    >
      <div className="bc-kpis">
        <div>
          <b>{l.published}</b>published
        </div>
        <div>
          <b>
            {l.with_results}
            <small> / {l.published}</small>
          </b>
          with results
        </div>
        {metricKeys.slice(0, 3).map((k) => (
          <div key={k}>
            <b>{num(l.by_metric[k].total)}</b>
            {lbl(k).toLowerCase()} across {l.by_metric[k].items} post
            {l.by_metric[k].items === 1 ? "" : "s"}
          </div>
        ))}
      </div>
      {l.with_results === 0 ? (
        <div className="bc-empty-big">
          <h2>No results recorded yet</h2>
          <p>
            Open a published post and record what your platform insights show,
            with the date you read them.
          </p>
        </div>
      ) : (
        <div className="bc-grid">
          {(
            [
              ["By pillar", l.by_pillar.map((x) => ({ key: x.pillar, ...x }))],
              [
                "By format",
                l.by_format.map((x) => ({ key: formatLabels[x.format], ...x })),
              ],
            ] as const
          ).map(([title, rows]) => (
            <section className="st-card" key={title} aria-label={title}>
              <h2>{title}</h2>
              <div className="bc-table-wrap">
                <table className="bc-table">
                  <thead>
                    <tr>
                      <th scope="col">Group</th>
                      <th scope="col">Published</th>
                      <th scope="col">With results</th>
                      {metricKeys.map((k) => (
                        <th scope="col" key={k}>
                          Avg {lbl(k).toLowerCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((x) => (
                      <tr key={x.key}>
                        <th scope="row">{x.key}</th>
                        <td>{x.published}</td>
                        <td>{x.with_results}</td>
                        {metricKeys.map((k) => (
                          <td key={k}>
                            {x.average[k] !== undefined
                              ? num(x.average[k])
                              : "–"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
          <section className="st-card bc-span" aria-labelledby="h-top">
            <h2 id="h-top">Most viewed</h2>
            {l.top.length ? (
              <ol className="bc-list">
                {l.top.map((t) => (
                  <li key={t.id}>
                    <Link href={`/brand/content/${t.id}?w=${w}`}>
                      {t.title}
                    </Link>
                    <span className="st-hint">
                      {num(t.value)} views · read {day(t.observed_on)} ·{" "}
                      {resultSources[t.source] ?? t.source}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="st-hint">No views recorded yet.</p>
            )}
          </section>
          <p className="st-hint bc-span">
            Each post counts once, with its latest reading per metric. Averages
            cover only posts with results; small groups say little.{" "}
            {l.metrics.reach?.not_unique &&
              "Reach is not a count of unique people."}
          </p>
        </div>
      )}
    </Shell>
  );
}

// ───────── One item: editor, review, checklist, publication, assets, results ─────────
function MoveButtons({ i, w }: { i: Detail; w: string }) {
  const moves: [Stage, string][] = [];
  if (i.stage === "idea") moves.push(["drafting", "Start drafting"]);
  if (i.stage === "drafting")
    moves.push(
      ["production", "Move to production"],
      ["in_review", "Send for review"],
    );
  if (i.stage === "production")
    moves.push(
      ["in_review", "Send for review"],
      ["drafting", "Back to drafting"],
    );
  if (i.stage === "approved")
    moves.push(["scheduled", "Schedule"], ["drafting", "Reopen for edits"]);
  if (i.stage === "scheduled") moves.push(["drafting", "Unschedule and edit"]);
  if (i.stage === "archived") moves.push(["drafting", "Restore"]);
  if (!["published", "archived"].includes(i.stage))
    moves.push(["archived", "Archive"]);
  return (
    <div className="bc-moves">
      {moves.map(([to, label]) => (
        <form action={act.moveItem} key={to}>
          <input type="hidden" name="w" value={w} />
          <input type="hidden" name="id" value={i.id} />
          <input type="hidden" name="to" value={to} />
          <input type="hidden" name="back" value={`/brand/content/${i.id}`} />
          <button
            className={
              "st-btn" +
              (["in_review", "scheduled", "drafting"].includes(to) &&
              moves[0][0] === to
                ? " primary"
                : "")
            }
          >
            {label}
          </button>
        </form>
      ))}
    </div>
  );
}
export async function ItemView({ id, sp }: { id: string; sp: SP }) {
  if (!uuidRe.test(id)) notFound();
  const b = await brandContext(one(sp, "w"));
  const w = b.workspaceId;
  const [r, ov] = await Promise.all([
    brandContent.item(b.client, w, id),
    brandContent.overview(b.client, w),
  ]);
  if (!r.ok || !ov.ok) notFound();
  const i = r.value;
  const o = ov.value;
  const locked = ["published", "archived"].includes(i.stage);
  const steps: Stage[] = [
    "idea",
    "drafting",
    "production",
    "in_review",
    "approved",
    "scheduled",
    "published",
  ];
  const at = steps.indexOf(i.stage);
  const missing = i.checklist_required.filter((k) => !i.checklist?.[k]);
  const allClaims = o.products.flatMap((p) =>
    p.claims.map((c) => `${c} (${p.name})`),
  );
  return (
    <main className="shell bc-main">
      <p>
        <Link href={`/brand/content/board?w=${w}`}>← Production board</Link>
      </p>
      <header className="bc-head">
        <div>
          <p className="bc-eyebrow">
            {formatLabels[i.format]} · {handle(i.account)}
            {i.source !== "team" && <> · {sourceLabels[i.source]}</>}
          </p>
          <h1>{i.title}</h1>
          <p className="st-hint">
            Version {i.version}
            {i.approved_current
              ? " · approved"
              : i.approved_version
                ? ` · version ${i.approved_version} was approved`
                : ""}{" "}
            · {nextStep(i)}
          </p>
        </div>
        <Chip stage={i.stage} />
      </header>
      <Flash sp={sp} />
      {one(sp, "reused") && (
        <p className="st-ok bc-flash" role="status">
          Draft created from Creator content. Write your caption, keep the
          credit, and send it for review.
        </p>
      )}
      <ol className="bc-steps" aria-label="Progress">
        {steps.map((s, k) => (
          <li
            key={s}
            className={k < at ? "done" : k === at ? "now" : ""}
            aria-current={k === at ? "step" : undefined}
          >
            {stageLabels[s]}
          </li>
        ))}
      </ol>
      <MoveButtons i={i} w={w} />
      <div className="bc-grid bc-item">
        <section className="st-card bc-span-2" aria-labelledby="h-edit">
          <h2 id="h-edit">{locked ? "Content" : "Editor"}</h2>
          {i.repurpose && (
            <div className="bc-note" role="note">
              Creator content by <b>{i.repurpose.creator}</b>, live{" "}
              {day(i.repurpose.published_on)}. Agreed rights:{" "}
              {rightsText({
                usage_months: i.repurpose.usage_months,
                channels: i.repurpose.channels,
              })}
              , until {day(i.repurpose.allowed_until)}.
              {i.rights_now && (
                <span className={i.rights_now.allowed ? "st-ok" : "st-error"}>
                  {" "}
                  {i.rights_now.reason}.
                </span>
              )}
              {i.repurpose.url && (
                <>
                  {" "}
                  <a
                    href={i.repurpose.url}
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                  >
                    Original
                  </a>
                </>
              )}
            </div>
          )}
          {locked ? (
            <dl className="bc-read">
              {(
                [
                  ["Hook", i.hook],
                  ["Script", i.script],
                  ["Caption", i.caption],
                  ["Call to action", i.cta],
                  ["Disclosure", i.disclosure],
                  ["Claims", i.claims.join("; ")],
                  ["Notes", i.notes],
                ] as const
              )
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd className="bc-pre">{v}</dd>
                  </div>
                ))}
            </dl>
          ) : (
            <EntityForm
              action={act.saveItem}
              label="Edit content"
              idPrefix="bc-ed"
              submit={
                i.approved_current
                  ? "Save (sends back to review)"
                  : "Save new version"
              }
              fields={[
                W(w),
                H("id", i.id),
                H("version", i.version),
                {
                  name: "title",
                  label: "Title",
                  value: i.title,
                  required: true,
                  max: 140,
                },
                {
                  name: "format",
                  label: "Format",
                  type: "select",
                  options: formatLabels,
                  value: i.format,
                  required: true,
                },
                {
                  name: "account_id",
                  label: "Account",
                  type: "select",
                  options: opts(o.accounts, (a) => handle(a), "Decide later"),
                  value: i.account_id ?? "",
                },
                {
                  name: "planned_for",
                  label: "Planned for",
                  type: "date",
                  value: i.planned_for ?? "",
                },
                {
                  name: "pillar_id",
                  label: "Pillar",
                  type: "select",
                  options: opts(o.pillars, (p) => p.name, "No pillar"),
                  value: i.pillar_id ?? "",
                },
                {
                  name: "segment_id",
                  label: "For customer group",
                  type: "select",
                  options: opts(
                    o.segments,
                    (s) =>
                      `${s.name}${s.basis === "hypothesis" ? " (unconfirmed)" : ""}`,
                    "Everyone",
                  ),
                  value: i.segment_id ?? "",
                },
                {
                  name: "product_id",
                  label: "Product",
                  type: "select",
                  options: opts(o.products, (p) => p.name, "None"),
                  value: i.product_id ?? "",
                },
                {
                  name: "hook",
                  label: "Hook",
                  type: "textarea",
                  rows: 2,
                  max: 300,
                  value: i.hook ?? "",
                  hint: "The first line or first three seconds.",
                },
                {
                  name: "script",
                  label: "Script or outline",
                  type: "textarea",
                  rows: 6,
                  max: 8000,
                  value: i.script ?? "",
                },
                {
                  name: "caption",
                  label: "Caption",
                  type: "textarea",
                  rows: 4,
                  max: 2200,
                  value: i.caption ?? "",
                },
                {
                  name: "cta",
                  label: "Call to action",
                  max: 200,
                  value: i.cta ?? "",
                },
                {
                  name: "disclosure",
                  label: "Disclosure or credit",
                  max: 300,
                  value: i.disclosure ?? "",
                  hint: o.guidelines?.disclosures
                    ? `Your guidelines: ${o.guidelines.disclosures}`
                    : "For example: Paid partnership, or Created with @creator.",
                },
                {
                  name: "claims",
                  label: "Claims made",
                  type: "lines",
                  rows: 3,
                  value: i.claims.join("\n"),
                  hint: allClaims.length
                    ? `One per line. Approved: ${allClaims.join("; ")}.`
                    : "One per line. Add approved claims to your products first.",
                },
                {
                  name: "notes",
                  label: "Production notes",
                  type: "textarea",
                  rows: 3,
                  max: 2000,
                  value: i.notes ?? "",
                },
              ]}
            />
          )}
          {i.unapproved_claims.length > 0 && !locked && (
            <p className="bc-flag-line" role="note">
              Not on your approved list: {i.unapproved_claims.join("; ")}.
              Approval will need a reason.
            </p>
          )}
        </section>
        <aside className="bc-side">
          {i.stage === "in_review" && (
            <section className="st-card" id="review" aria-labelledby="h-rev">
              <h2 id="h-rev">Review version {i.version}</h2>
              <EntityForm
                action={act.reviewItem}
                label="Review"
                idPrefix="bc-rv"
                submit="Submit review"
                fields={[
                  W(w),
                  H("id", i.id),
                  H("version", i.version),
                  {
                    name: "decision",
                    label: "Decision",
                    type: "select",
                    required: true,
                    options: {
                      approved: "Approve this version",
                      changes_requested: "Request changes",
                    },
                  },
                  {
                    name: "note",
                    label: "Note",
                    type: "textarea",
                    rows: 3,
                    max: 1000,
                    hint: i.unapproved_claims.length
                      ? "Required: say why the unlisted claims are acceptable."
                      : "Required when you request changes.",
                  },
                ]}
              />
            </section>
          )}
          {["approved", "scheduled"].includes(i.stage) && (
            <section className="st-card" id="publish" aria-labelledby="h-pub">
              <h2 id="h-pub">Publish</h2>
              <p className="st-hint">
                AURA does not post for you. Post the approved version on{" "}
                {handle(i.account)}, then record it here.
              </p>
              <ul className="bc-check">
                {i.checklist_required.map((k) => {
                  const on = !!i.checklist?.[k];
                  return (
                    <li key={k}>
                      <form action={act.toggleCheck}>
                        <input type="hidden" name="w" value={w} />
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="key" value={k} />
                        <input
                          type="hidden"
                          name="done"
                          value={on ? "0" : "1"}
                        />
                        <button
                          className={"bc-tick" + (on ? " on" : "")}
                          aria-pressed={on}
                        >
                          <span aria-hidden="true">{on ? "✓" : ""}</span>{" "}
                          {checklistLabels[k]}
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
              {missing.length ? (
                <p className="st-hint">
                  {missing.length} step{missing.length === 1 ? "" : "s"} left
                  before you can mark it published.
                </p>
              ) : (
                <EntityForm
                  action={act.publishItem}
                  label="Mark as published"
                  idPrefix="bc-pub"
                  submit="Mark as published"
                  fields={[
                    W(w),
                    H("id", i.id),
                    {
                      name: "url",
                      label: "Link to the live post",
                      type: "url",
                      required: true,
                      max: 2048,
                    },
                    {
                      name: "published_on",
                      label: "Went live on",
                      type: "date",
                      required: true,
                      value: today(),
                    },
                  ]}
                />
              )}
            </section>
          )}
          {i.stage === "published" && (
            <section className="st-card" aria-labelledby="h-live">
              <h2 id="h-live">Live</h2>
              <p>
                Published {day(i.published_on)} on {handle(i.account)}.{" "}
                <a
                  href={i.published_url ?? "#"}
                  rel="noopener noreferrer nofollow"
                  target="_blank"
                >
                  View post
                </a>
              </p>
            </section>
          )}
          <section className="st-card" aria-labelledby="h-hist">
            <h2 id="h-hist">History</h2>
            <ul className="bc-hist">
              {i.reviews.map((rv, k) => (
                <li key={"r" + k}>
                  <b>
                    {
                      {
                        approved: "Approved",
                        changes_requested: "Changes requested",
                        submitted: "Sent for review",
                        reopened: "Back to review",
                      }[rv.decision]
                    }{" "}
                    · v{rv.version}
                  </b>
                  <span className="st-hint">
                    {rv.by} · {when(rv.at)}
                  </span>
                  {rv.note && <span className="bc-pre">{rv.note}</span>}
                  {rv.unapproved_claims.length > 0 &&
                    rv.decision === "approved" && (
                      <span className="st-hint">
                        Cleared: {rv.unapproved_claims.join("; ")}
                      </span>
                    )}
                </li>
              ))}
              {i.revisions.map((v) => (
                <li key={"v" + v.version}>
                  <span>Version {v.version} saved</span>
                  <span className="st-hint">
                    {v.by} · {when(v.at)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
        <section className="st-card" id="assets" aria-labelledby="h-as">
          <h2 id="h-as">Assets</h2>
          <p className="st-hint">
            Links to where the files are kept, with where they came from. AURA
            does not store the files.
          </p>
          {i.assets.length > 0 && (
            <ul className="bc-list">
              {i.assets.map((a) => (
                <li key={a.id}>
                  <a
                    href={a.url}
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                  >
                    {a.title}
                  </a>
                  <span className="st-hint">
                    {assetKinds[a.kind] ?? a.kind} ·{" "}
                    {provenanceLabels[a.provenance] ?? a.provenance}
                    {a.rights_note && ` · ${a.rights_note}`}
                  </span>
                  <form action={act.removeAsset}>
                    <input type="hidden" name="w" value={w} />
                    <input type="hidden" name="asset" value={a.id} />
                    <input type="hidden" name="item" value={i.id} />
                    <button className="st-btn bc-small">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <EntityForm
            action={act.addAsset}
            label="Add an asset"
            idPrefix="bc-as"
            submit="Add asset"
            fields={[
              W(w),
              H("item", i.id),
              { name: "title", label: "Name", required: true, max: 120 },
              {
                name: "url",
                label: "Link (https)",
                type: "url",
                required: true,
                max: 2048,
              },
              {
                name: "kind",
                label: "Type",
                type: "select",
                options: assetKinds,
                required: true,
              },
              {
                name: "provenance",
                label: "Where it came from",
                type: "select",
                options: provenanceLabels,
                required: true,
              },
              {
                name: "rights_note",
                label: "Rights note",
                max: 500,
                showIf: {
                  field: "provenance",
                  in: ["creator", "licensed", "other"],
                },
                hint: "Which agreement or licence allows this use.",
              },
            ]}
          />
        </section>
        {i.stage === "published" && (
          <section
            className="st-card bc-span-2"
            id="results"
            aria-labelledby="h-res"
          >
            <h2 id="h-res">Results</h2>
            {i.results.length > 0 && (
              <div className="bc-table-wrap">
                <table className="bc-table">
                  <thead>
                    <tr>
                      <th scope="col">Metric</th>
                      <th scope="col">Value</th>
                      <th scope="col">Read on</th>
                      <th scope="col">Source</th>
                      <th scope="col">Entered by</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {i.results.map((x) => (
                      <tr key={x.id} className={x.voided ? "void" : ""}>
                        <th scope="row">
                          {o.metrics[x.metric]?.label ?? x.metric}
                        </th>
                        <td>{num(x.value)}</td>
                        <td>{day(x.observed_on)}</td>
                        <td>
                          {resultSources[x.source] ?? x.source}
                          {x.note && (
                            <span className="st-hint"> · {x.note}</span>
                          )}
                        </td>
                        <td>{x.by}</td>
                        <td>
                          {x.voided ? (
                            <span className="st-hint">
                              Voided: {x.void_reason}
                            </span>
                          ) : (
                            <form action={act.voidResult}>
                              <input type="hidden" name="w" value={w} />
                              <input type="hidden" name="result" value={x.id} />
                              <input type="hidden" name="item" value={i.id} />
                              <button className="st-btn bc-small">Void</button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <EntityForm
              action={act.recordResult}
              label="Record a result"
              idPrefix="bc-res"
              submit="Record"
              fields={[
                W(w),
                H("id", i.id),
                {
                  name: "metric",
                  label: "Metric",
                  type: "select",
                  required: true,
                  options: Object.fromEntries(
                    Object.entries(o.metrics).map(([k, m]) => [k, m.label]),
                  ),
                },
                {
                  name: "value",
                  label: "Value (total so far)",
                  type: "number",
                  min: 0,
                  required: true,
                },
                {
                  name: "observed_on",
                  label: "Read on",
                  type: "date",
                  value: today(),
                  required: true,
                },
                {
                  name: "source",
                  label: "Source",
                  type: "select",
                  options: resultSources,
                  required: true,
                },
                { name: "note", label: "Note", max: 300 },
              ]}
            />
            <p className="st-hint">
              Enter the total shown on the day you read it. Newer readings
              replace older ones; nothing is added twice.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
