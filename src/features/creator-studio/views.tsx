import Link from "next/link";
import { Lock } from "lucide-react";
import {
  buildChecklist,
  checklistSummary,
} from "@/features/creator-onboarding/checklist";
import { evaluateEligibility } from "@/features/creator-onboarding/eligibility";
import { recommend } from "@/features/creator-onboarding/recommendations";
import { EligibilityPanel } from "@/features/creator-onboarding/summary";
import {
  goalCategories,
  label,
  niches,
  stages,
  availabilityText,
  collaborationCategories,
} from "@/features/creator-onboarding/taxonomy";
import type { CreatorState } from "@/features/creator-onboarding/types";
import { setActionStatus } from "./actions";
import { TrendChart } from "./chart";
import { type CommercialSummary } from "./commercial";
import { ObservationForm, IdeaForm, type GoalOption } from "./forms";
import { chartable, evaluateGoals, insights, type GoalView } from "./goals";
import { areas } from "./nav";
import {
  essentialNotices,
  headline,
  situationOf,
  widgetOrder,
  wantsUgc,
  type Situation,
} from "./personalization";
import {
  milestoneLabels,
  type DailyAction,
  type Idea,
  type Milestones,
  type Observation,
  type WidgetId,
  type Weekly,
  type ActionStatus,
} from "./types";
import { describeWeek, weekLabel } from "./weekly";
import { OpenDialog } from "./nav-client";
import type { FormState } from "./actions";

export type StudioData = {
  state: CreatorState;
  prefs: {
    hidden_widgets: WidgetId[];
    gamification_enabled: boolean;
    today: string;
  };
  today: DailyAction[];
  history: DailyAction[];
  observations: Observation[];
  ideas: { total: number; items: Idea[] };
  milestones: Milestones;
  weekly: Weekly;
  commercial: CommercialSummary;
  live: boolean;
};
type Act = (prev: FormState, form: FormData) => Promise<FormState>;
const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";
const catLabel: Record<string, string> = {
  growth_plan: "Growth plan",
  content: "Content",
  profile: "Profile",
  observation: "Progress",
  education: "Learn",
  commercial: "Collaboration prep",
  weekly: "Weekly review",
};
const statusText: Record<ActionStatus, string> = {
  pending: "To do",
  completed: "Done",
  skipped: "Skipped",
  deferred: "Deferred",
};
export const goalOptions = (state: CreatorState): GoalOption[] =>
  state.goals
    .filter((g) => g.metric)
    .map((g) => ({
      key: `${g.category}:${g.metric}`,
      label: `${label(goalCategories, g.category)}${g.target_value !== null ? ` (target ${g.target_value})` : ""}`,
    }));

export function Card({
  id,
  title,
  children,
  wide,
  accent,
  tour,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  accent?: boolean;
  tour?: string;
}) {
  return (
    <section
      className={`st-card${wide ? " wide" : ""}${accent ? " accent" : ""}`}
      aria-labelledby={`${id}-h`}
      data-tour={tour}
    >
      <h2 id={`${id}-h`}>{title}</h2>
      {children}
    </section>
  );
}
export function ActionRow({
  a,
  live,
  back = "/creator/actions",
  full,
}: {
  a: DailyAction;
  live: boolean;
  back?: string;
  full?: boolean;
}) {
  const btn = (status: ActionStatus, text: string, primary = false) => (
    <form action={setActionStatus} key={status}>
      <input type="hidden" name="action" value={a.id} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="back" value={back} />
      <button
        className={`st-btn${primary ? " primary" : ""}`}
        disabled={!live}
        aria-label={`${text}: ${a.title}`}
      >
        {text}
      </button>
    </form>
  );
  return (
    <li className="st-item" data-status={a.status}>
      <div>
        <div className="row">
          <span className="st-badge">{catLabel[a.category] ?? a.category}</span>
          <span className={`st-badge ${a.status === "completed" ? "ok" : ""}`}>
            {statusText[a.status]}
          </span>
          {a.source === "growth_plan" && (
            <span className="st-badge">From your plan</span>
          )}
          {a.dependency && (
            <span className="st-badge warn">
              Preparation only · {a.dependency}
            </span>
          )}
        </div>
        <h3 style={{ marginTop: "0.35rem" }}>{a.title}</h3>
        <p className="st-hint" style={{ margin: 0 }}>
          {a.detail}
        </p>
        {a.status === "completed" && a.status_at && (
          <p className="st-hint" style={{ margin: "0.25rem 0 0" }}>
            Completed {fmt(a.status_at)}
          </p>
        )}
        {a.href && (
          <p style={{ margin: "0.3rem 0 0" }}>
            <Link href={a.href}>Open</Link>
          </p>
        )}
        {a.dependency && (
          <p className="st-hint" style={{ margin: "0.2rem 0 0" }}>
            Marking this done means you prepared. The related feature (
            {a.dependency}) is not built yet.
          </p>
        )}
      </div>
      {full !== false && (
        <div className="row">
          {a.status === "pending" ? (
            <>
              {btn("completed", "Done", true)}
              {btn("deferred", "Later")}
              {btn("skipped", "Skip")}
            </>
          ) : (
            btn("pending", "Undo")
          )}
        </div>
      )}
    </li>
  );
}
function GoalLine({ v }: { v: GoalView }) {
  const p = v.progress;
  return (
    <li className="st-item" style={{ gridTemplateColumns: "1fr" }}>
      <div>
        <h3>
          {v.categoryLabel}
          {v.metricLabel ? ` · ${v.metricLabel}` : ""}
        </h3>
        {v.status === "no_measure" && (
          <p className="st-hint">No number to track yet. {v.nextAction}</p>
        )}
        {v.status === "no_observation" && (
          <p className="st-hint">
            <span className="st-badge warn">Unknown</span> Nothing recorded yet.{" "}
            {v.target !== null ? `Target ${v.target}.` : ""} {v.nextAction}
          </p>
        )}
        {v.latest && (
          <>
            <p style={{ margin: 0 }}>
              <strong>{v.latest.value}</strong>
              {v.target !== null ? <> of target {v.target}</> : null}{" "}
              <span className="st-hint">
                · {v.latest.observed_on} · {v.source}
              </span>
              {v.freshness === "stale" && (
                <>
                  {" "}
                  <span className="st-badge warn">Stale</span>
                </>
              )}
            </p>
            {p.kind === "from_baseline" && (
              <>
                <div
                  className="st-bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.max(0, Math.min(100, p.percent))}
                  aria-label={`${v.categoryLabel} progress`}
                >
                  <span
                    style={{
                      width: `${Math.max(0, Math.min(100, p.percent))}%`,
                    }}
                  />
                </div>
                <p className="st-hint" style={{ margin: "0.2rem 0 0" }}>
                  {p.percent}% of the way from your starting number (
                  {v.baseline?.value}, self-reported) to your target.
                </p>
              </>
            )}
            {p.kind === "of_target" && (
              <p className="st-hint" style={{ margin: "0.2rem 0 0" }}>
                No starting number was recorded, so no percentage is shown.
              </p>
            )}
            {v.timeframeDays && (
              <p className="st-hint" style={{ margin: 0 }}>
                Timeframe: {v.timeframeDays} days. {v.nextAction}
              </p>
            )}
          </>
        )}
      </div>
    </li>
  );
}
function Actions({ d }: { d: StudioData }) {
  const done = d.today.filter((a) => a.status === "completed").length;
  return (
    <Card id="actions" title="Today’s actions" wide tour="actions">
      <p className="st-hint">
        {done} of {d.today.length} done today. Rule-based suggestions from your
        own answers, not AI.
      </p>
      <ul className="st-list">
        {d.today.map((a) => (
          <ActionRow key={a.id} a={a} live={d.live} back="/creator/dashboard" />
        ))}
      </ul>
      <p style={{ margin: "0.7rem 0 0" }}>
        <Link href="/creator/actions">All actions and earlier days</Link>
      </p>
    </Card>
  );
}
function Plan({ d }: { d: StudioData }) {
  const plan = d.state.plan;
  if (!plan)
    return (
      <Card id="plan" title="Growth plan">
        <p className="st-hint">
          Your starter plan is not available yet. Finish onboarding to create
          it.
        </p>
        <Link href="/onboarding/creator">Continue onboarding</Link>
      </Card>
    );
  const done = plan.actions.filter((a) => a.status === "done").length;
  return (
    <Card id="plan" title="Your seven-day starter plan">
      <p className="st-hint">
        Initial guidance based on your answers. Rule-based, not AI-generated.
        Created{" "}
        {new Date(plan.created_at).toLocaleDateString("en-IN", {
          dateStyle: "medium",
        })}
        .
      </p>
      <div
        className="st-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={plan.actions.length}
        aria-valuenow={done}
        aria-label="Plan actions done"
      >
        <span style={{ width: `${(done / plan.actions.length) * 100}%` }} />
      </div>
      <p className="st-hint" style={{ marginTop: "0.3rem" }}>
        {done} of {plan.actions.length} plan actions done
      </p>
      <ol className="st-list">
        {plan.actions
          .filter((a) => a.status !== "done")
          .slice(0, 3)
          .map((a) => (
            <li key={a.id}>
              <strong>Day {a.day}:</strong> {a.title}
            </li>
          ))}
      </ol>
    </Card>
  );
}
function Goals({ views }: { views: GoalView[] }) {
  return (
    <Card id="goals" title="Goal progress" tour="goals">
      {!views.length ? (
        <p className="st-hint">
          You have not set a goal yet.{" "}
          <Link href="/onboarding/creator/goals">Add one</Link>.
        </p>
      ) : (
        <ul className="st-list">
          {views.slice(0, 3).map((v) => (
            <GoalLine key={v.key} v={v} />
          ))}
        </ul>
      )}
      <p style={{ margin: "0.6rem 0 0" }}>
        <Link href="/creator/progress">Open progress</Link>
      </p>
    </Card>
  );
}
function Content({ d }: { d: StudioData }) {
  return (
    <Card id="content" title="Content">
      <p className="st-hint">
        Upcoming content: none planned. Planning and the calendar arrive with
        Content Studio (M08).
      </p>
      {d.ideas.items.length ? (
        <ul className="st-list">
          {d.ideas.items.slice(0, 3).map((i) => (
            <li key={i.id}>{i.title}</li>
          ))}
        </ul>
      ) : (
        <p className="st-hint">
          No ideas saved yet. One line is enough to start.
        </p>
      )}
      <div
        className="row"
        style={{
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap",
          marginTop: "0.6rem",
        }}
      >
        <OpenDialog target="quick-create-dialog" className="st-btn primary">
          Capture an idea
        </OpenDialog>
        <Link className="st-btn" href="/creator/create">
          Your ideas ({d.ideas.total})
        </Link>
        <button
          type="button"
          className="st-btn"
          disabled
          title="Arrives with Content Studio"
        >
          Calendar · planned (M08)
        </button>
      </div>
    </Card>
  );
}
function Checklist({ d }: { d: StudioData }) {
  const items = buildChecklist(d.state),
    sum = checklistSummary(items);
  return (
    <Card id="checklist" title="Profile checklist">
      <p className="st-hint">
        {sum.requiredDone} of {sum.requiredTotal} required done ·{" "}
        {sum.optionalAddressed} of {sum.optionalTotal} optional addressed.
        Skipping is fine, and this is not a quality score.
      </p>
      <ul className="st-list">
        {items
          .filter((i) => i.state !== "done")
          .slice(0, 4)
          .map((i) => (
            <li
              key={i.id}
              className="st-item"
              style={{ gridTemplateColumns: "1fr" }}
            >
              {i.href ? (
                <Link href={i.href}>{i.label}</Link>
              ) : (
                <span>
                  <Lock aria-hidden size={12} /> {i.label}
                </span>
              )}
              <span className="st-hint">
                {i.state === "unavailable"
                  ? i.note
                  : i.state === "skipped"
                    ? "Skipped for now"
                    : "To do"}
              </span>
            </li>
          ))}
      </ul>
      <Link href="/onboarding/creator/profile">Edit my profile</Link>
    </Card>
  );
}
function Recs({ d }: { d: StudioData }) {
  const e = evaluateEligibility(d.state);
  const recs = recommend(d.state, []);
  return (
    <Card id="recs" title="Opportunities">
      {recs.empty && (
        <p className="st-hint">
          No published opportunities yet, so nothing is shown. We never display
          placeholder campaigns.
        </p>
      )}
      <p>
        <strong>Standard collaborations:</strong> {e.standardInfluencer.text}
      </p>
      <p>
        <strong>UGC:</strong> {e.ugc.text}
      </p>
      <Link href="/creator/recommendations">Eligibility and preparation</Link>
    </Card>
  );
}
function Commercial({ d }: { d: StudioData }) {
  return <CommercialCard summary={d.commercial} />;
}
export function CommercialCard({ summary }: { summary: CommercialSummary }) {
  return (
    <Card id="commercial" title="Commercial overview">
      {summary.status === "unavailable" && (
        <>
          <p>
            <span className="st-badge warn">
              Not available yet · {summary.module}
            </span>
          </p>
          <p className="st-hint">{summary.text}</p>
        </>
      )}
      {summary.status === "none" && <p className="st-hint">{summary.text}</p>}
      {summary.status === "records" && (
        <dl>
          <dt>Agreed compensation</dt>
          <dd>
            {summary.agreed_minor / 100} {summary.currency}
          </dd>
          <dt>Externally recorded payments</dt>
          <dd>
            {summary.recorded_payments_minor / 100} {summary.currency}
          </dd>
          <dt>Outstanding</dt>
          <dd>
            {summary.outstanding_minor / 100} {summary.currency}
          </dd>
        </dl>
      )}
    </Card>
  );
}
function Milestones({ d }: { d: StudioData }) {
  const m = d.milestones;
  if (!m.enabled)
    return (
      <Card id="milestones" title="Milestones">
        <p className="st-hint">
          Milestones and streaks are switched off. You can turn them on in{" "}
          <Link href="/creator/settings/dashboard">dashboard settings</Link>.
        </p>
      </Card>
    );
  return (
    <Card id="milestones" title="Milestones">
      <p className="st-hint">
        Private to you. Based only on what you have really done. No rankings.
      </p>
      <p>
        {m.streak && m.streak.current > 0 ? (
          <>
            <strong>{m.streak.current}</strong> day
            {m.streak.current === 1 ? "" : "s"} in a row with a completed
            action.
          </>
        ) : (
          "No current streak. Complete an action to start one. Missing a day costs you nothing."
        )}
      </p>
      <ul className="st-list">
        {m.milestones.map((x) => (
          <li key={x.code}>
            <strong>{milestoneLabels[x.code]?.title}</strong>{" "}
            <span className="st-hint">
              ·{" "}
              {new Date(x.achieved_at).toLocaleDateString("en-IN", {
                dateStyle: "medium",
              })}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
function WeeklyCard({ d }: { d: StudioData }) {
  const cur = describeWeek(d.weekly.current),
    last = d.weekly.reviews[0];
  return (
    <Card id="weekly" title="This week">
      <p className="st-hint">{weekLabel(d.weekly.current)} · so far</p>
      {cur.lines.length ? (
        <ul className="st-list">
          {cur.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : (
        <p className="st-hint">Nothing recorded yet this week.</p>
      )}
      <p className="st-hint">{cur.focus}</p>
      {last ? (
        <p>
          <Link href="/creator/progress#weekly">Read last week’s review</Link>
        </p>
      ) : (
        <p className="st-hint">
          Your first full weekly review appears after your first complete week.
        </p>
      )}
    </Card>
  );
}
function SocialWidget({ d }: { d: StudioData }) {
  const list = d.state.social_accounts.filter(
    (a) =>
      !a.lifecycle ||
      a.lifecycle === "active" ||
      a.lifecycle === "disconnected",
  );
  const verified = list.filter((a) => a.verification === "verified").length;
  return (
    <Card id="w-social" title="Social accounts">
      {list.length === 0 ? (
        <p>No account added yet. That is fine; add one when you are ready.</p>
      ) : (
        <p>
          {list.length} account{list.length === 1 ? "" : "s"}, {verified} with
          verified ownership. Numbers are self-reported unless stated.
        </p>
      )}
      <p>
        <Link href="/creator/socials">Manage social accounts</Link>
      </p>
    </Card>
  );
}
export function DashboardView({ d }: { d: StudioData }) {
  const s = d.state,
    sit: Situation = situationOf(s);
  const order = widgetOrder(
    s,
    d.prefs.hidden_widgets,
    d.prefs.gamification_enabled,
  );
  const views = evaluateGoals(s.goals, d.observations, d.prefs.today);
  const stage = stages.find(([c]) => c === s.profile?.stage)?.[1];
  const primary = s.niches.find((n) => n.role === "primary");
  const widgets: Record<WidgetId, React.ReactNode> = {
    actions: <Actions key="a" d={d} />,
    plan: <Plan key="p" d={d} />,
    goals: <Goals key="g" views={views} />,
    content: <Content key="c" d={d} />,
    checklist: <Checklist key="ch" d={d} />,
    recommendations: <Recs key="r" d={d} />,
    commercial: <Commercial key="co" d={d} />,
    milestones: <Milestones key="m" d={d} />,
    weekly: <WeeklyCard key="w" d={d} />,
    social: <SocialWidget key="so" d={d} />,
  };
  return (
    <>
      <h1>{headline(s, sit)}</h1>
      <p className="st-hint">
        {stage ?? "Creator"}
        {primary
          ? ` · ${primary.custom_label ?? label(niches, primary.code)}`
          : s.profile?.niche_exploring
            ? " · still exploring your niche"
            : ""}{" "}
        ·{" "}
        {s.social_accounts.length
          ? `${s.social_accounts.length} account${s.social_accounts.length === 1 ? "" : "s"} (self-reported)`
          : "no social account yet, which is fine"}
      </p>
      <div className="st-notices" role="region" aria-label="Important notices">
        {essentialNotices(s).map((n) => (
          <p className="st-notice" key={n.id}>
            {n.text}
          </p>
        ))}
      </div>
      {sit === "no_accounts" && (
        <p className="st-hint">
          No audience numbers are shown because none exist yet. Your plan and
          daily actions work without them.
        </p>
      )}
      <div className="st-grid">{order.map((w) => widgets[w])}</div>
      {d.prefs.hidden_widgets.length > 0 && (
        <p className="st-hint" style={{ marginTop: "1rem" }}>
          {d.prefs.hidden_widgets.length} widget
          {d.prefs.hidden_widgets.length === 1 ? " is" : "s are"} hidden.{" "}
          <Link href="/creator/settings/dashboard">Change in settings</Link>.
        </p>
      )}
    </>
  );
}
export function ActionsView({ d }: { d: StudioData }) {
  const byDay = new Map<string, DailyAction[]>();
  for (const a of d.history)
    byDay.set(a.local_date, [...(byDay.get(a.local_date) ?? []), a]);
  return (
    <>
      <h1>Daily actions</h1>
      <p className="st-hint">
        Three to five practical actions a day, chosen from your goals,
        challenges and plan. Rule-based, not AI-generated. {d.prefs.today}
      </p>
      <section aria-labelledby="today-h" className="st-card">
        <h2 id="today-h">Today</h2>
        <ul className="st-list">
          {d.today.map((a) => (
            <ActionRow key={a.id} a={a} live={d.live} />
          ))}
        </ul>
      </section>
      <section aria-labelledby="prev-h" style={{ marginTop: "1.2rem" }}>
        <h2 id="prev-h">Earlier days</h2>
        {!byDay.size ? (
          <p className="st-hint">
            Nothing earlier yet. Past days appear here once they exist.
          </p>
        ) : (
          [...byDay.entries()].map(([day, list]) => (
            <details
              key={day}
              className="st-card"
              style={{ marginBottom: "0.5rem" }}
            >
              <summary>
                {day} · {list.filter((a) => a.status === "completed").length} of{" "}
                {list.length} done
              </summary>
              <ul className="st-list" style={{ marginTop: "0.5rem" }}>
                {list.map((a) => (
                  <ActionRow key={a.id} a={a} live={d.live} full={false} />
                ))}
              </ul>
            </details>
          ))
        )}
      </section>
    </>
  );
}
export function ProgressView({
  d,
  recordObservation,
}: {
  d: StudioData;
  recordObservation?: Act;
}) {
  const s = d.state,
    views = evaluateGoals(s.goals, d.observations, d.prefs.today),
    ins = insights(views, d.observations);
  const counts = d.history
    .concat(d.today)
    .reduce(
      (m, a) => ({ ...m, [a.status]: (m[a.status] ?? 0) + 1 }),
      {} as Record<string, number>,
    );
  const gaps: string[] = [];
  if (!s.social_accounts.length)
    gaps.push(
      "No social account is added, so there are no account observations. You can still record your own numbers.",
    );
  if (s.goals.some((g) => !g.metric))
    gaps.push(
      "Some goals have no number to track. Add a measure to see progress.",
    );
  for (const v of views) {
    if (v.status === "no_observation")
      gaps.push(`${v.categoryLabel}: nothing recorded yet.`);
    if (v.freshness === "stale")
      gaps.push(
        `${v.categoryLabel}: your latest entry is more than 14 days old.`,
      );
  }
  return (
    <>
      <h1>Progress</h1>
      <p className="st-hint">
        Everything here comes from numbers you recorded or things you did.
        Nothing is estimated. Today is {d.prefs.today}.
      </p>
      <div className="st-split">
        <div className="st-grid" style={{ gridTemplateColumns: "1fr" }}>
          <Card id="pg" title="Goals">
            {!views.length ? (
              <p className="st-hint">
                No goals yet.{" "}
                <Link href="/onboarding/creator/goals">Add a goal</Link>.
              </p>
            ) : (
              <ul className="st-list">
                {views.map((v) => (
                  <li key={v.key} style={{ display: "grid", gap: "0.5rem" }}>
                    <ul className="st-list">
                      <GoalLine v={v} />
                    </ul>
                    {v.metric && (
                      <TrendChart
                        series={chartable(d.observations, v.category, v.metric)}
                        label={`${v.categoryLabel} ${v.metricLabel}`}
                        target={v.target}
                      />
                    )}
                    {v.metric && v.observationCount === 1 && (
                      <p className="st-hint">
                        One observation so far. A trend chart appears after a
                        second.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {ins.length > 0 && (
              <>
                <h3>What your numbers show</h3>
                <ul className="st-list">
                  {ins.map((i) => (
                    <li key={i} className="st-hint">
                      {i}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
          <Card id="gaps" title="Data gaps">
            {gaps.length ? (
              <ul className="st-list">
                {gaps.map((g) => (
                  <li key={g} className="st-hint">
                    {g}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="st-hint">No gaps to flag right now.</p>
            )}
          </Card>
          <Card id="wk" title="Weekly reviews">
            <div id="weekly" />
            <h3>This week so far</h3>
            {(() => {
              const c = describeWeek(d.weekly.current);
              return (
                <>
                  <ul className="st-list">
                    {c.lines.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                  <p className="st-hint">{c.focus}</p>
                </>
              );
            })()}
            {!d.weekly.reviews.length ? (
              <p className="st-hint">
                No completed week yet. Reviews are created once a full
                Monday–Sunday week has passed since you activated.
              </p>
            ) : (
              d.weekly.reviews.map((r) => {
                const w = describeWeek(r.summary);
                return (
                  <details
                    key={r.week_start}
                    className="st-card"
                    style={{ marginTop: "0.5rem" }}
                  >
                    <summary>
                      Week {weekLabel(r.summary)}
                      {w.sufficient ? "" : " · not enough recorded"}
                    </summary>
                    {w.lines.length ? (
                      <ul className="st-list">
                        {w.lines.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="st-hint">{w.focus}</p>
                  </details>
                );
              })
            )}
            <p className="st-hint">
              Email digest:{" "}
              {d.weekly.digest_opt_in
                ? "you opted in, but email delivery is not set up yet, so nothing is sent"
                : "off"}
              . <Link href="/creator/settings/dashboard">Settings</Link>
            </p>
          </Card>
        </div>
        <div className="st-grid" style={{ gridTemplateColumns: "1fr" }}>
          <Card id="rec" title="Record progress" accent>
            <p className="st-hint">
              Enter your own number. It is saved as a new entry and earlier ones
              are kept.
            </p>
            <ObservationForm
              action={recordObservation}
              goals={goalOptions(s)}
              live={d.live}
              today={d.prefs.today}
              idPrefix="pg-obs"
            />
          </Card>
          <Card id="comp" title="Action completion">
            <p className="st-hint">Last 14 days plus today.</p>
            <p>
              {counts.completed ?? 0} completed · {counts.skipped ?? 0} skipped
              · {counts.deferred ?? 0} deferred · {counts.pending ?? 0} still to
              do
            </p>
          </Card>
          <Milestones d={d} />
        </div>
      </div>
    </>
  );
}
const explain: { id: string; title: string; how: string }[] = [
  {
    id: "growth",
    title: "Growth access",
    how: "Open to every Creator from day one. It does not depend on followers or connected accounts.",
  },
  {
    id: "standard",
    title: "Standard influencer collaborations",
    how: "Needs at least one of your own accounts with 100 or more followers. Counts on different accounts are never added together. To get ready, add or update a follower count and keep creating consistently.",
  },
  {
    id: "ugc",
    title: "UGC",
    how: "Assessed separately and does not need 100 followers. The assessment criteria are not published yet, so nothing here says you do or do not qualify.",
  },
  {
    id: "observations",
    title: "Missing account observations",
    how: "Self-reported counts are labelled as such. Add a count and a date for your accounts, or record progress on the Progress page.",
  },
  {
    id: "ownership",
    title: "Account ownership",
    how: "Your accounts are unverified until social account management (M05) exists. Follower counts alone never verify anything.",
  },
  {
    id: "verification",
    title: "Commercial verification",
    how: "Optional now, and required before designated commercial activities. Preparing early helps, but it is not a guarantee of acceptance.",
  },
  {
    id: "campaign",
    title: "Campaign-specific requirements",
    how: "Each campaign sets its own requirements and checks them when you apply. They are evaluated separately from everything above.",
  },
];
export function RecommendationsView({ state }: { state: CreatorState }) {
  const recs = recommend(state, []),
    excluded = state.industry_exclusions.length;
  const wants = collaborationCategories.filter(([c]) =>
    state.collaborations.some((x) => x.category === c && x.interested),
  );
  return (
    <>
      <h1>Recommendations</h1>
      <p className="st-hint">
        Matched to your niche, platforms, collaboration preferences and
        exclusions. No private goals or challenges are ever shared with a Brand.
      </p>
      <div className="st-split">
        <div className="st-grid" style={{ gridTemplateColumns: "1fr" }}>
          <Card id="opps" title="Opportunities for you">
            {recs.empty && (
              <p>
                No published opportunities yet. The marketplace (M10) is not
                available, so nothing is invented here. Use this time to
                prepare:
              </p>
            )}
            <ul className="st-list">
              {recs.preparation.map((p) => (
                <li
                  key={p.id}
                  className="st-item"
                  style={{ gridTemplateColumns: "1fr" }}
                >
                  <strong>{p.title}</strong>
                  <span className="st-hint">{p.detail}</span>
                  {p.href && <Link href={p.href}>Open</Link>}
                </li>
              ))}
            </ul>
            <p className="st-hint">
              Industries you excluded ({excluded}) are never recommended.
              {wants.length
                ? ` Interested in: ${wants.map(([, l, a]) => `${l} (${availabilityText[a].toLowerCase()})`).join(", ")}.`
                : " You have not chosen collaboration types, which is fine."}
              {wantsUgc(state) ? " UGC is assessed separately." : ""}
            </p>
          </Card>
          <Card id="why" title="How eligibility works">
            <ul className="st-list">
              {explain.map((x) => (
                <li key={x.id}>
                  <h3>{x.title}</h3>
                  <p className="st-hint">{x.how}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <Card id="stand" title="Where you stand">
          <EligibilityPanel state={state} />
        </Card>
      </div>
    </>
  );
}
export function ModuleList({ areaId }: { areaId: string }) {
  const area = areas.find((a) => a.id === areaId)!;
  return (
    <ul className="st-list">
      {area.items.map((i) =>
        i.href ? (
          <li
            key={i.id}
            className="st-item"
            style={{ gridTemplateColumns: "1fr" }}
          >
            <Link href={i.href}>
              <strong>{i.label}</strong>
            </Link>
            {i.note && <span className="st-hint">{i.note}</span>}
          </li>
        ) : (
          <li
            key={i.id}
            className="st-item"
            style={{ gridTemplateColumns: "1fr" }}
          >
            <span>
              <Lock aria-hidden size={14} /> <strong>{i.label}</strong>{" "}
              <span className="st-badge warn">Planned · {i.module}</span>
            </span>
            <span className="st-hint">{i.note}</span>
          </li>
        ),
      )}
    </ul>
  );
}
export function CreateView({
  d,
  captureIdea,
}: {
  d: StudioData;
  captureIdea?: Act;
}) {
  return (
    <>
      <h1>Create</h1>
      <p className="st-hint">
        Capture ideas now. Scripts, planning and the content calendar arrive
        with Content Studio (M08).
      </p>
      <div className="st-split">
        <div className="st-grid" style={{ gridTemplateColumns: "1fr" }}>
          <Card id="cap" title="Capture an idea" accent>
            <IdeaForm action={captureIdea} live={d.live} idPrefix="cr-idea" />
          </Card>
          <Card id="ideas" title={`Your ideas (${d.ideas.total})`}>
            {d.ideas.items.length ? (
              <ul className="st-list">
                {d.ideas.items.map((i) => (
                  <li
                    key={i.id}
                    className="st-item"
                    style={{ gridTemplateColumns: "1fr" }}
                  >
                    <strong>{i.title}</strong>
                    {i.note && <span className="st-hint">{i.note}</span>}
                    <span className="st-hint">{fmt(i.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="st-hint">
                No ideas yet. Your first one takes ten seconds.
              </p>
            )}
          </Card>
        </div>
        <Card id="plan" title="Content planning">
          <p className="st-hint">
            Upcoming content: none. The calendar and planner are planned for
            M08.
          </p>
          <ModuleList areaId="create" />
        </Card>
      </div>
    </>
  );
}
