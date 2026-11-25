import Link from "next/link";
import { notFound } from "next/navigation";
import { analytics, type Experiment } from "@/server/analytics/service";
import {
  loadBase,
  must,
  one,
  syncInsights,
  type Base,
  type Params,
} from "@/server/analytics/load";
import { addDays } from "./periods";
import { aggregations } from "./semantics";
import { netGrowth, comparePeriods, intervalTotal, toPoints } from "./growth";
import { accountEngagement, contentEngagement } from "./engagement";
import { consolidateLatest, weightedRate } from "./consolidate";
import { compareContent } from "./compare";
import { analyzePattern, type Dimension } from "./patterns";
import { timingAnalysis } from "./timing";
import { scenarioForecast } from "./forecast";
import {
  canMove,
  editable,
  measure,
  outcomeHint,
  outcomeLabels,
  outcomes,
  templates,
} from "./experiments";
import { generateInsights, diagnosticsFrom } from "./insights";
import * as contracts from "./contracts";
import { features } from "./features";
import {
  Filters,
  fmt,
  Limits,
  Missing,
  Notice,
  Quality,
  SectionNav,
  SeriesChart,
  signed,
} from "./ui";
import { AudienceForm, ExperimentForm, GrantForm } from "./forms";
import * as act from "./actions";
import { freshness } from "@/features/creator-social/freshness";
import {
  metrics,
  metricLabel,
  metricsFor,
} from "@/features/creator-social/metrics";
import { platformLabel } from "@/features/creator-social/catalogue";
import {
  sourceLabel,
  type AccountObs,
  type ContentItem,
  type Source,
} from "./types";

const H = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2 id={id}>{children}</h2>
);
const Card = ({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) => (
  <section className="st-card" aria-labelledby={`${id}-h`}>
    <H id={`${id}-h`}>{title}</H>
    {children}
  </section>
);
const acctLabel = (a: { handle: string; platform: string }) =>
  `@${a.handle} (${platformLabel(a.platform)})`;
const growthText = (g: ReturnType<typeof netGrowth>) =>
  g.status === "unavailable"
    ? null
    : `${signed(g.net)}${g.pct !== null ? ` (${g.pct}%)` : ""}`;

export async function OverviewView({ sp }: { sp: Params }) {
  const b = await loadBase(sp);
  const content = must(
    await analytics.content(b.ctx.client, b.ctx.workspaceId, null),
  ).content;
  const exps = must(
    await analytics.experiments(b.ctx.client, b.ctx.workspaceId),
  );
  const list = generateInsights({
    today: b.today,
    period: b.range.current,
    previous: b.range.previous,
    accounts: b.allAccounts,
    observations: b.series.observations,
    content,
    hasActiveExperiment: exps.some((e) => e.status === "active"),
  });
  const diagnostics = diagnosticsFrom(list, b.range.current).slice(0, 3);
  const recent = [...b.observations]
    .sort(
      (x, y) =>
        y.observed_on.localeCompare(x.observed_on) ||
        y.entered_at.localeCompare(x.entered_at),
    )
    .slice(0, 5);
  return (
    <main>
      <h1>Creator analytics</h1>
      <p>
        What changed, what supports it, and what you could test next. Every
        number here is one you recorded
        {b.allAccounts.some((a) => a.connection === "connected")
          ? " or a connected account supplied"
          : ""}
        ; nothing is estimated.
      </p>
      <SectionNav current="/creator/analytics" />
      <Notice sp={sp} />
      {b.allAccounts.length === 0 ? (
        <Card id="prep" title="Start with preparation, not empty charts">
          <p>
            You have no social account yet, so there is nothing to chart and
            nothing is shown as zero. These steps get you ready:
          </p>
          <ul className="st-list">
            <li className="st-item">
              <Link href="/creator/socials/new">
                Add an account when you have one
              </Link>{" "}
              and record its follower count.
            </li>
            <li className="st-item">
              <Link href="/creator/progress">Set a measurable goal</Link> so
              your progress has something to be measured against.
            </li>
            <li className="st-item">
              <Link href="/creator/create">Plan your first content</Link> so you
              have something to learn from.
            </li>
            <li className="st-item">
              <Link href="/creator/recommendations">
                Read your recommendations
              </Link>{" "}
              for what to learn first.
            </li>
          </ul>
        </Card>
      ) : (
        <>
          <Filters b={b} action="/creator/analytics" current="overview" />
          <Card id="growth" title="Account growth">
            <ul className="st-list">
              {b.accounts.map((a) => {
                const pts = toPoints(b.series.observations, a.id, "followers");
                const cur = netGrowth(pts, b.range.current);
                const prev = netGrowth(pts, b.range.previous);
                const cmp = comparePeriods(cur, prev);
                const fr = freshness(
                  "followers",
                  a.platform,
                  pts.at(-1)?.date ?? null,
                  b.today,
                  { disconnected: a.lifecycle === "disconnected" },
                );
                return (
                  <li key={a.id} className="st-item">
                    <strong>{acctLabel(a)}</strong>
                    {cur.status === "unavailable" ? (
                      <p>
                        Net audience change: not available. {cur.reason}{" "}
                        {cur.need}
                      </p>
                    ) : (
                      <p>
                        Net audience change: <strong>{growthText(cur)}</strong>{" "}
                        between {cur.baseline.date} and {cur.latest.date} (
                        {cur.coveredDays} of {cur.periodDays} days covered).
                      </p>
                    )}
                    {cmp.status === "blocked" ? (
                      <p className="st-hint">
                        Previous-period comparison unavailable: {cmp.reasons[0]}
                      </p>
                    ) : (
                      <p className="st-hint">
                        Previous period: {signed(cmp.previousNet)}.{" "}
                        {cmp.notes.join(" ")}
                      </p>
                    )}
                    <p className="st-hint">
                      {fr.label}
                      {fr.recommendation ? `. ${fr.recommendation}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
            <p>
              <Link href="/creator/analytics/accounts">
                Account details and charts
              </Link>
            </p>
          </Card>
          <Card id="goals" title="Goal progress">
            <p>
              {b.ctx.state.goals.length
                ? `${b.ctx.state.goals.length} goal${b.ctx.state.goals.length === 1 ? "" : "s"} set.`
                : "No goals set yet."}{" "}
              Goal tracking lives in{" "}
              <Link href="/creator/progress">Progress</Link>; M06 reads the same
              observations.
            </p>
          </Card>
          <Card id="recent" title="Recent observations">
            {recent.length === 0 ? (
              <p>Nothing recorded in this range.</p>
            ) : (
              <ul className="st-list">
                {recent.map((o) => (
                  <li key={o.id} className="st-item">
                    {metricLabel(o.metric)}: {fmt(o.value)} on {o.observed_on} ·{" "}
                    <Quality
                      source={o.source}
                      corrected={o.corrected}
                      evidence={o.has_evidence}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card id="content" title="Content performance">
            <p>
              {content.length} content item{content.length === 1 ? "" : "s"}{" "}
              recorded.{" "}
              {content.length === 0
                ? "Record a post's numbers to start comparing content."
                : ""}{" "}
              <Link href="/creator/analytics/content">
                Open content analytics
              </Link>
              .
            </p>
          </Card>
          <Card id="diag" title="Growth diagnostics (rule-based)">
            <p className="st-hint">
              These are fixed rules applied to your records. They are not AI,
              they carry no confidence figure, and they never combine into a
              score.
            </p>
            {diagnostics.length === 0 ? (
              <Missing
                title="Not enough to diagnose yet"
                reason="No rule has enough recorded evidence to say anything specific."
                need="Record numbers regularly and add content metrics. Each finding appears here with its evidence."
                href="/creator/socials"
                cta="Update your accounts"
              />
            ) : (
              <ul className="st-list">
                {diagnostics.map((d) => (
                  <li key={d.id} className="st-item">
                    <strong>{d.finding}</strong>
                    <p>{d.definition}</p>
                    <p className="st-hint">
                      Analysis period {d.period.start} to {d.period.end}.
                    </p>
                    <Limits items={d.limitations} />
                    <Link href={d.href}>{d.action}</Link>
                  </li>
                ))}
              </ul>
            )}
            <p>
              <Link href="/creator/analytics/insights">All insights</Link>
            </p>
          </Card>
          <Card id="exp" title="Experiments">
            <p>
              {exps.filter((e) => e.status === "active").length} active,{" "}
              {exps.filter((e) => e.status === "completed").length} completed.{" "}
              <Link href="/creator/experiments">
                Open the Growth Experiment Lab
              </Link>
              .
            </p>
          </Card>
          <Card id="commercial" title="Commercial content">
            <p>{contracts.commercialLink.reason}</p>
          </Card>
        </>
      )}
    </main>
  );
}

export async function AccountsView({ sp }: { sp: Params }) {
  const b = await loadBase(sp);
  const cons = consolidateLatest(
    b.observations,
    b.accounts,
    "followers",
    b.today,
  );
  const reachCons = consolidateLatest(
    b.observations,
    b.accounts,
    "reach",
    b.today,
  );
  const rows = b.accounts.map((a) => {
    const interactions = intervalTotal(
      b.observations,
      a.id,
      "interactions",
      b.range.current,
      { summable: true },
    );
    const reach = intervalTotal(
      b.observations,
      a.id,
      "reach",
      b.range.current,
      { summable: false },
    );
    const pts = toPoints(b.series.observations, a.id, "followers");
    const followersLatest =
      pts.filter((p) => p.date <= b.range.current.end).at(-1)?.value ?? null;
    return { a, interactions, reach, pts, followersLatest };
  });
  const weighted = weightedRate(
    rows.map((r) => ({
      account: r.a.id,
      numerator: r.interactions.status === "ok" ? r.interactions.total : null,
      denominator: r.reach.status === "ok" ? r.reach.total : null,
    })),
  );
  return (
    <main>
      <h1>Account analytics</h1>
      <SectionNav current="/creator/analytics/accounts" />
      <Filters b={b} action="/creator/analytics/accounts" current="accounts" />
      {b.accounts.length === 0 && (
        <Missing
          title="No account to analyse"
          reason="No tracked account matches this selection."
          href="/creator/socials/new"
          cta="Add an account"
        />
      )}
      {rows.length > 0 && (
        <Card id="cons" title="Across your accounts">
          {cons.status === "aggregate" ? (
            <>
              <p>
                <strong>{fmt(cons.total)}</strong> · {cons.label}
              </p>
              <p className="st-hint">
                {cons.caveat} {cons.coverage}
              </p>
              <ul className="st-list">
                {cons.contributions.map((c) => (
                  <li key={c.account.id} className="st-item">
                    {acctLabel(c.account)}:{" "}
                    {c.value === null
                      ? "not recorded (unknown, not zero)"
                      : `${fmt(c.value)} on ${c.observedOn}${c.staleNote ? ` · ${c.staleNote}` : ""}`}
                  </li>
                ))}
              </ul>
              <Limits
                items={[
                  cons.method,
                  "AURA has no evidence about how many people overlap across platforms and does not guess.",
                ]}
              />
            </>
          ) : (
            <p>{cons.reason}</p>
          )}
          <p className="st-hint">
            Reach:{" "}
            {reachCons.status === "per_account_only" ? reachCons.reason : ""}
          </p>
          {weighted.status === "ok" ? (
            <p>
              Account interactions per reach, weighted by denominator:{" "}
              <strong>{weighted.percent}%</strong> across {weighted.accounts} of{" "}
              {weighted.of} accounts.{" "}
              <span className="st-hint">{weighted.method}</span>
            </p>
          ) : (
            <p className="st-hint">
              A combined engagement rate is not shown: {weighted.reason}
            </p>
          )}
        </Card>
      )}
      {rows.map(({ a, interactions, reach, pts, followersLatest }) => {
        const cur = netGrowth(pts, b.range.current),
          prev = netGrowth(pts, b.range.previous),
          cmp = comparePeriods(cur, prev);
        const fc = scenarioForecast(pts, 30);
        const imp = intervalTotal(
          b.observations,
          a.id,
          "impressions",
          b.range.current,
          { summable: aggregations.impressions.includes("sum_same_window") },
        );
        const er =
          interactions.status === "ok" && reach.status === "ok"
            ? accountEngagement(interactions.total, reach.total, "reach")
            : null;
        const ef =
          interactions.status === "ok"
            ? accountEngagement(
                interactions.total,
                followersLatest,
                "followers",
              )
            : null;
        return (
          <Card key={a.id} id={`acc-${a.id}`} title={acctLabel(a)}>
            <h3>Audience count</h3>
            {cur.status === "unavailable" ? (
              <Missing
                title="Net change unavailable"
                reason={cur.reason}
                need={cur.need}
                href={`/creator/socials/${a.id}/metrics`}
                cta="Record a number"
              />
            ) : (
              <>
                <p>
                  <strong>{growthText(cur)}</strong> from{" "}
                  {fmt(cur.baseline.value)} on {cur.baseline.date} to{" "}
                  {fmt(cur.latest.value)} on {cur.latest.date}.
                </p>
                <p className="st-hint">
                  Observation coverage: {cur.coveredDays} of {cur.periodDays}{" "}
                  days. {cur.notes.join(" ")} {cur.pctNote ?? ""}
                </p>
                <p className="st-hint">
                  {cmp.status === "blocked"
                    ? `Previous-period comparison blocked: ${cmp.reasons.join(" ")}`
                    : `Previous period ${signed(cmp.previousNet)}; change in net growth ${signed(cmp.change)}. ${cmp.notes.join(" ")}`}
                </p>
              </>
            )}
            <SeriesChart
              label={`Followers or subscribers, ${acctLabel(a)}`}
              points={pts
                .filter(
                  (p) =>
                    p.date >= b.range.previous.start &&
                    p.date <= b.range.current.end,
                )
                .map((p) => ({
                  date: p.date,
                  value: p.value,
                  source: p.source,
                  corrected: p.corrected,
                }))}
            />
            <h3>This period</h3>
            <ul className="st-list">
              <li className="st-item">
                Reach:{" "}
                {reach.status === "unavailable"
                  ? `not available. ${reach.reason}`
                  : `${fmt(reach.total)} (window ${reach.windows[0].start} to ${reach.windows[0].end})`}
              </li>
              <li className="st-item">
                Impressions:{" "}
                {imp.status === "unavailable"
                  ? `not available. ${imp.reason}`
                  : `${fmt(imp.total)} over ${imp.coveredDays} of ${imp.periodDays} days. ${imp.notes.join(" ")}`}
              </li>
              <li className="st-item">
                Interactions:{" "}
                {interactions.status === "unavailable"
                  ? `not available. ${interactions.reason}`
                  : `${fmt(interactions.total)} over ${interactions.coveredDays} of ${interactions.periodDays} days.`}
              </li>
              <li className="st-item">
                Engagement by reach:{" "}
                {er?.status === "ok" ? (
                  <>
                    {er.percent}%{" "}
                    <span className="st-hint">({er.formula})</span>
                  </>
                ) : (
                  "not available (needs interactions and reach for the same period)."
                )}
              </li>
              <li className="st-item">
                Engagement by followers:{" "}
                {ef?.status === "ok" ? (
                  <>
                    {ef.percent}%{" "}
                    <span className="st-hint">({ef.formula})</span>
                  </>
                ) : (
                  "not available."
                )}
              </li>
            </ul>
            <p className="st-hint">
              Reach and impressions are different measures and are never
              swapped. The two engagement rates use different denominators and
              are not interchangeable.
            </p>
            <h3>
              Scenario range{" "}
              {features.forecast.tier === "advanced" ? "(advanced)" : ""}
            </h3>
            {fc.status === "insufficient" ? (
              <Missing
                title="Not enough history for a range"
                reason={fc.reasons.join(" ")}
                need={fc.need}
              />
            ) : (
              <>
                <ul className="st-list">
                  {fc.scenarios.map((s) => (
                    <li key={s.name} className="st-item">
                      {s.name}: about {fmt(s.value)} in {fc.horizonDays} days
                    </li>
                  ))}
                </ul>
                <p className="st-hint">{fc.basis}</p>
                <Limits items={fc.limitations} />
              </>
            )}
          </Card>
        );
      })}
    </main>
  );
}

const contentFilters = (items: ContentItem[], sp: Params) => {
  const platform = one(sp, "platform"),
    account = one(sp, "account"),
    format = one(sp, "format"),
    spons = one(sp, "sponsorship"),
    topic = one(sp, "tag")?.toLowerCase(),
    from = one(sp, "from"),
    to = one(sp, "to"),
    source = one(sp, "source");
  return items.filter(
    (i) =>
      (!platform || i.platform === platform) &&
      (!account || i.account_id === account) &&
      (!format || i.format === format) &&
      (!from || (i.published_on ?? "") >= from) &&
      (!to || (i.published_on ?? "9999") <= to) &&
      (!topic || i.tags.some((t) => t.value.toLowerCase().includes(topic))) &&
      (!source || i.observations.some((o) => o.source === source)) &&
      (!spons ||
        (spons === "unclassified"
          ? !i.tags.some((t) => t.kind === "sponsorship")
          : i.tags.some(
              (t) =>
                t.kind === "sponsorship" && t.value.toLowerCase() === spons,
            ))),
  );
};
export async function ContentView({ sp }: { sp: Params }) {
  const b = await loadBase({});
  const all = must(
    await analytics.content(b.ctx.client, b.ctx.workspaceId, null),
  ).content;
  const items = contentFilters(all, sp);
  const metric =
    one(sp, "metric") && metrics.some((m) => m.code === one(sp, "metric"))
      ? one(sp, "metric")!
      : "views";
  const dims: Dimension[] = [
    "format",
    "topic",
    "hook",
    "duration",
    "pillar",
    "style",
    "sponsorship",
  ];
  const platformOnly =
    one(sp, "platform") ||
    (new Set(all.map((i) => i.platform)).size === 1
      ? all[0]?.platform
      : undefined);
  const scoped = platformOnly
    ? items.filter((i) => i.platform === platformOnly)
    : items;
  const tz = b.ctx.prefs.timezone;
  const patterns = dims.map((d) => ({
    d,
    r: analyzePattern(scoped, d, metric),
  }));
  const timing = timingAnalysis(scoped, metric);
  return (
    <main>
      <h1>Content analytics</h1>
      <SectionNav current="/creator/analytics/content" />
      <Notice sp={sp} />
      <form
        method="get"
        aria-label="Filter content"
        className="st-card"
        style={{
          display: "grid",
          gap: "0.5rem",
          gridTemplateColumns: "repeat(auto-fit,minmax(9rem,1fr))",
        }}
      >
        <div className="st-field">
          <label htmlFor="c-platform">Platform</label>
          <select
            id="c-platform"
            name="platform"
            defaultValue={one(sp, "platform") ?? ""}
          >
            <option value="">All</option>
            {[...new Set(all.map((i) => i.platform))].map((p) => (
              <option key={p} value={p}>
                {platformLabel(p)}
              </option>
            ))}
          </select>
        </div>
        <div className="st-field">
          <label htmlFor="c-account">Account</label>
          <select
            id="c-account"
            name="account"
            defaultValue={one(sp, "account") ?? ""}
          >
            <option value="">All</option>
            {b.allAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {acctLabel(a)}
              </option>
            ))}
          </select>
        </div>
        <div className="st-field">
          <label htmlFor="c-format">Format</label>
          <select
            id="c-format"
            name="format"
            defaultValue={one(sp, "format") ?? ""}
          >
            <option value="">All</option>
            {[
              "short_video",
              "long_video",
              "image",
              "carousel",
              "story",
              "text",
              "live",
              "other",
            ].map((f) => (
              <option key={f} value={f}>
                {f.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="st-field">
          <label htmlFor="c-tag">Tag contains</label>
          <input id="c-tag" name="tag" defaultValue={one(sp, "tag") ?? ""} />
        </div>
        <div className="st-field">
          <label htmlFor="c-spons">Organic or sponsored</label>
          <select
            id="c-spons"
            name="sponsorship"
            defaultValue={one(sp, "sponsorship") ?? ""}
          >
            <option value="">All</option>
            <option value="organic">Organic</option>
            <option value="sponsored">Sponsored</option>
            <option value="unclassified">Not classified</option>
          </select>
        </div>
        <div className="st-field">
          <label htmlFor="c-source">Data source</label>
          <select
            id="c-source"
            name="source"
            defaultValue={one(sp, "source") ?? ""}
          >
            <option value="">All</option>
            {(Object.keys(sourceLabel) as Source[]).map((s) => (
              <option key={s} value={s}>
                {sourceLabel[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="st-field">
          <label htmlFor="c-from">Published from</label>
          <input
            id="c-from"
            type="date"
            name="from"
            defaultValue={one(sp, "from") ?? ""}
          />
        </div>
        <div className="st-field">
          <label htmlFor="c-to">Published to</label>
          <input
            id="c-to"
            type="date"
            name="to"
            defaultValue={one(sp, "to") ?? ""}
          />
        </div>
        <div className="st-field">
          <label htmlFor="c-metric">Metric for patterns</label>
          <select id="c-metric" name="metric" defaultValue={metric}>
            {metrics
              .filter((m) => m.scope === "content")
              .map((m) => (
                <option key={m.code} value={m.code}>
                  {m.label}
                </option>
              ))}
          </select>
        </div>
        <div>
          <button className="st-btn primary">Apply</button>
        </div>
      </form>
      {all.length === 0 ? (
        <Missing
          title="No content recorded yet"
          reason="Content appears here after you record its numbers. AURA does not import or invent posts."
          href="/creator/socials"
          cta="Record content metrics on an account"
        />
      ) : (
        <form
          method="get"
          action="/creator/analytics/compare"
          aria-label="Choose content to compare"
        >
          <p className="st-hint">
            {items.length} of {all.length} items shown. Select two or more to
            compare.
          </p>
          <input type="hidden" name="metric" value={metric} />
          <ul className="st-list">
            {items.map((i) => {
              const er = contentEngagement(i, "engagement_by_reach");
              const tagsList = i.tags;
              return (
                <li key={i.id} className="st-item">
                  <label>
                    <input type="checkbox" name="id" value={i.id} />{" "}
                    <strong>{i.title ?? i.external_id}</strong>
                  </label>
                  <p className="st-hint">
                    {platformLabel(i.platform)} · @{i.handle} ·{" "}
                    {i.format?.replace("_", " ") ?? "format not set"} ·{" "}
                    {i.published_on
                      ? `published ${i.published_on}`
                      : "publication date not set"}
                    {i.url ? "" : ""}
                  </p>
                  <ul>
                    {[...new Set(i.observations.map((o) => o.metric))].map(
                      (m) => {
                        const o = i.observations
                          .filter((x) => x.metric === m)
                          .at(-1)!;
                        return (
                          <li key={m}>
                            {metricLabel(m)}: {fmt(o.value)} (
                            {o.window_kind === "lifetime"
                              ? `lifetime as of ${o.observed_on}`
                              : `${o.period_start} to ${o.period_end}`}
                            ) ·{" "}
                            <Quality
                              source={o.source}
                              corrected={o.corrected}
                            />
                          </li>
                        );
                      },
                    )}
                  </ul>
                  {er.status === "ok" && (
                    <p className="st-hint">
                      Engagement by reach {er.percent}% ({er.formula};{" "}
                      {er.basis}).
                    </p>
                  )}
                  <p className="st-hint">
                    Tags:{" "}
                    {tagsList.length
                      ? tagsList
                          .map(
                            (t) =>
                              `${t.kind}: ${t.value}${t.status === "proposed" ? " (proposed, needs your review)" : ""}`,
                          )
                          .join(" · ")
                      : "none (optional)"}
                  </p>
                  {i.published_at && (
                    <p className="st-hint">
                      Publishing time recorded ({i.tz}).
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <button className="st-btn">Compare selected</button>
        </form>
      )}
      {items.length > 0 && (
        <Card id="tagging" title="Tags and publishing time (optional)">
          <p className="st-hint">
            Tags let AURA look for patterns. You never have to tag everything.
            No tag is added for you: {contracts.aiClassification.reason}
          </p>
          {items.slice(0, 20).map((i) => (
            <details key={i.id}>
              <summary>{i.title ?? i.external_id}</summary>
              <ul>
                {i.tags.map((t) => (
                  <li key={t.id}>
                    {t.kind}: {t.value} ·{" "}
                    {t.source === "manual" ? "added by you" : t.source}
                    {t.status === "proposed" ? (
                      <>
                        {" "}
                        <form
                          action={act.reviewTag}
                          style={{ display: "inline" }}
                        >
                          <input type="hidden" name="tag" value={t.id} />
                          <input type="hidden" name="action" value="confirm" />
                          <button className="st-btn">Confirm</button>
                        </form>{" "}
                        <form
                          action={act.reviewTag}
                          style={{ display: "inline" }}
                        >
                          <input type="hidden" name="tag" value={t.id} />
                          <input type="hidden" name="action" value="reject" />
                          <button className="st-btn">Reject</button>
                        </form>
                      </>
                    ) : (
                      <form
                        action={act.removeTag}
                        style={{ display: "inline" }}
                      >
                        <input type="hidden" name="tag" value={t.id} />
                        <button
                          className="st-btn"
                          aria-label={`Remove tag ${t.value}`}
                        >
                          Remove
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
              <form
                action={act.setTag}
                aria-label={`Add a tag to ${i.title ?? i.external_id}`}
              >
                <input type="hidden" name="content" value={i.id} />
                <div className="st-field">
                  <label htmlFor={`k-${i.id}`}>Kind</label>
                  <select id={`k-${i.id}`} name="kind">
                    <option value="topic">Topic</option>
                    <option value="niche">Niche</option>
                    <option value="pillar">Content pillar</option>
                    <option value="hook">Hook type</option>
                    <option value="duration">Duration range</option>
                    <option value="style">Style</option>
                    <option value="sponsorship">Organic or sponsored</option>
                    <option value="custom">Your own</option>
                  </select>
                </div>
                <div className="st-field">
                  <label htmlFor={`v-${i.id}`}>Value</label>
                  <input
                    id={`v-${i.id}`}
                    name="value"
                    maxLength={60}
                    required
                  />
                </div>
                <button className="st-btn">Add tag</button>
              </form>
              <form
                action={act.setTiming}
                aria-label={`Set the publishing time of ${i.title ?? i.external_id}`}
              >
                <input type="hidden" name="content" value={i.id} />
                <input type="hidden" name="tz" value={tz} />
                <div className="st-field">
                  <label htmlFor={`d-${i.id}`}>Published on</label>
                  <input
                    id={`d-${i.id}`}
                    type="date"
                    name="date"
                    defaultValue={i.published_on ?? ""}
                    max={b.today}
                    required
                  />
                </div>
                <div className="st-field">
                  <label htmlFor={`t-${i.id}`}>Local time ({tz})</label>
                  <input id={`t-${i.id}`} type="time" name="time" required />
                </div>
                <button className="st-btn">Save publishing time</button>
              </form>
            </details>
          ))}
        </Card>
      )}
      <Card
        id="patterns"
        title="Patterns in your content (exploratory, rule-based)"
      >
        <p className="st-hint">
          Metric: {metricLabel(metric)}. This compares groups of your own
          content on one shared measurement basis. It does not show cause.{" "}
          {platformOnly
            ? ""
            : "Choose a platform to analyse: platforms are never mixed."}
        </p>
        {patterns.map(({ d, r }) =>
          r.status === "ok" ? (
            <div key={d} className="st-item">
              <strong>{d}</strong> ({r.strength}):{" "}
              {r.groups
                .map((g) => `${g.value} n=${g.n}, median ${fmt(g.median)}`)
                .join(" · ")}
              . Basis: {r.basis}. {r.unclassified} item(s) without this tag were
              left out.
              <Limits items={r.limitations} />
            </div>
          ) : (
            <div key={d} className="st-item">
              <strong>{d}</strong>: not enough yet. {r.reason} {r.need}
            </div>
          ),
        )}
      </Card>
      <Card id="timing" title="Publishing time (evidence and limits)">
        <p>
          {timing.timed} of {timing.total} items have a recorded publishing
          time.
        </p>
        {timing.suggestion ? (
          <p>
            {timing.suggestion.text} Confidence: {timing.confidence} (low means
            a small sample).{" "}
          </p>
        ) : (
          <Missing
            title="Not enough to suggest a window"
            reason="Timing patterns need publishing times and enough comparable content in at least two time windows."
            need={timing.experiment ?? ""}
            href="/creator/experiments/new?template=publishing-window"
            cta="Plan a publishing-window experiment"
          />
        )}
        <Limits items={timing.limitations} />
      </Card>
    </main>
  );
}

export async function CompareView({ sp }: { sp: Params }) {
  const b = await loadBase({});
  const all = must(
    await analytics.content(b.ctx.client, b.ctx.workspaceId, null),
  ).content;
  const ids = [sp.id].flat().filter((x): x is string => typeof x === "string");
  const metric =
    one(sp, "metric") &&
    metrics.some((m) => m.code === one(sp, "metric") && m.scope === "content")
      ? one(sp, "metric")!
      : "views";
  const chosen = all.filter((i) => ids.includes(i.id));
  const result = chosen.length >= 2 ? compareContent(chosen, metric) : null;
  return (
    <main>
      <h1>Compare content</h1>
      <SectionNav current="/creator/analytics/compare" />
      <p>
        Two items are compared only when their numbers mean the same thing.
        There is no overall score.
      </p>
      <form method="get" aria-label="Choose content to compare">
        <div className="st-field">
          <label htmlFor="cm-metric">Metric</label>
          <select id="cm-metric" name="metric" defaultValue={metric}>
            {metrics
              .filter((m) => m.scope === "content")
              .map((m) => (
                <option key={m.code} value={m.code}>
                  {m.label}
                </option>
              ))}
          </select>
        </div>
        {all.length === 0 ? (
          <Missing
            title="No content to compare"
            reason="Record content metrics first."
            href="/creator/socials"
            cta="Record content metrics"
          />
        ) : (
          <fieldset>
            <legend>Content ({all.length})</legend>
            {all.map((i) => (
              <label key={i.id} style={{ display: "block" }}>
                <input
                  type="checkbox"
                  name="id"
                  value={i.id}
                  defaultChecked={ids.includes(i.id)}
                />{" "}
                {i.title ?? i.external_id}{" "}
                <span className="st-hint">
                  ({platformLabel(i.platform)}, {i.published_on ?? "no date"})
                </span>
              </label>
            ))}
          </fieldset>
        )}
        <button className="st-btn primary">Compare</button>
      </form>
      {!result && ids.length > 0 && (
        <p className="st-hint">Choose at least two items.</p>
      )}
      {result && !result.comparable && (
        <section className="st-card" aria-labelledby="blocked-h">
          <H id="blocked-h">These cannot be compared fairly</H>
          <ul>
            {result.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {result.alternative && (
            <p>
              <strong>What would work:</strong> {result.alternative}
            </p>
          )}
          <ul className="st-list">
            {result.rows.map((r) => (
              <li key={r.item.id} className="st-item">
                {r.item.title ?? r.item.external_id}:{" "}
                {r.obs
                  ? `${fmt(r.obs.value)} (${r.obs.window_kind === "lifetime" ? `lifetime as of ${r.obs.observed_on}` : `${r.obs.period_start} to ${r.obs.period_end}`})`
                  : "no comparable value recorded"}
              </li>
            ))}
          </ul>
        </section>
      )}
      {result?.comparable && (
        <section className="st-card" aria-labelledby="cmp-h">
          <H id="cmp-h">
            {metricLabel(metric)} · {result.basisLabel}
          </H>
          <p>{result.reading}</p>
          <div className="st-grid">
            {result.rows.map((r) => (
              <div key={r.item.id} className="st-card">
                <h3>{r.item.title ?? r.item.external_id}</h3>
                <p>
                  <strong>{fmt(r.obs!.value)}</strong>
                </p>
                <p className="st-hint">
                  Order {r.rank} of {result.rows.length} ·{" "}
                  {r.obs!.window_kind === "lifetime"
                    ? `as of ${r.obs!.observed_on}`
                    : `${r.obs!.period_start} to ${r.obs!.period_end}`}
                </p>
                <Quality source={r.obs!.source} corrected={r.obs!.corrected} />
              </div>
            ))}
          </div>
          {result.notes.length > 0 && (
            <p className="st-hint">{result.notes.join(" ")}</p>
          )}
        </section>
      )}
    </main>
  );
}

export async function AudienceView({ sp }: { sp: Params }) {
  const b = await loadBase({});
  const aud = must(
    await analytics.audience(b.ctx.client, b.ctx.workspaceId),
  ).snapshots;
  const grants = must(await analytics.grants(b.ctx.client, b.ctx.workspaceId));
  const accounts = b.allAccounts.map((a) => ({
    id: a.id,
    label: acctLabel(a),
  }));
  const platform = b.allAccounts[0]?.platform;
  const optIn = one(sp, "cohort");
  const cohort = platform
    ? must(
        await analytics.cohort(
          b.ctx.client,
          b.ctx.workspaceId,
          platform,
          b.today,
        ),
      )
    : null;
  const dimLabel: Record<string, string> = {
    geography: "Country or region",
    language: "Language",
    age_band: "Age band",
    activity: "Activity",
  };
  return (
    <main>
      <h1>Audience</h1>
      <SectionNav current="/creator/analytics/audience" />
      <Notice sp={sp} />
      <p>
        Aggregate information your platform shows you, recorded by you. AURA
        never collects follower identities and never infers who your audience is
        from your name, appearance or nationality.
      </p>
      {accounts.length === 0 ? (
        <Missing
          title="Add an account first"
          reason="Audience information belongs to an account."
          href="/creator/socials/new"
          cta="Add an account"
        />
      ) : (
        <>
          <Card id="snapshots" title="What you recorded">
            {aud.length === 0 ? (
              <Missing
                title="No audience information yet"
                reason="Nothing is shown because nothing is recorded. There is no estimate and no placeholder."
                need="Open your platform's audience or insights screen and copy the top countries, languages or age bands with their percentages."
              />
            ) : (
              <ul className="st-list">
                {aud.map((s) => {
                  const a = b.allAccounts.find((x) => x.id === s.account_id);
                  return (
                    <li key={s.id} className="st-item">
                      <strong>{dimLabel[s.dimension]}</strong> ·{" "}
                      {a ? acctLabel(a) : ""} · observed {s.observed_on} ·{" "}
                      {sourceLabel[s.source as Source]}
                      <ul>
                        {s.buckets.map((x) => (
                          <li key={x.bucket}>
                            {x.bucket}: {x.share}%
                          </li>
                        ))}
                      </ul>
                      <p className="st-hint">
                        Out of: {s.denominator_kind.replace("_", " ")}
                        {s.denominator !== null
                          ? ` (${fmt(s.denominator)})`
                          : ""}{" "}
                        ·{" "}
                        {s.coverage_pct !== null
                          ? `covers ${s.coverage_pct}% of the audience`
                          : "coverage not stated"}
                        . Percentages are copied from the platform and may not
                        add up to 100.
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card id="record" title="Record audience information">
            <AudienceForm
              action={act.recordAudience}
              accounts={accounts}
              today={b.today}
            />
          </Card>
          <Card id="share" title="Share with a Brand (optional)">
            <p>
              Sharing is private by default. A share covers one account, the
              groups you tick, one stated purpose and, optionally, an end date.
              The Brand sees only the percentages, never your insights,
              experiments or earnings. You can revoke it at any time.
            </p>
            {grants.length > 0 && (
              <ul className="st-list">
                {grants.map((g) => (
                  <li key={g.id} className="st-item">
                    {g.status === "active" ? "Active" : "Revoked"}:{" "}
                    {g.dimensions.map((d) => dimLabel[d]).join(", ")} ·{" "}
                    {g.purpose}
                    {g.valid_until
                      ? ` · until ${g.valid_until.slice(0, 10)}`
                      : ""}
                    {g.status === "active" && (
                      <form action={act.revokeAudience}>
                        <input type="hidden" name="grant" value={g.id} />
                        <button className="st-btn">Revoke</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <GrantForm action={act.grantAudience} accounts={accounts} />
          </Card>
          <Card id="cohort" title="Peer benchmark (optional)">
            <p>{contracts.campaignMatching.reason}</p>
            <p>
              Peer benchmarks are anonymous quartiles from creators who also
              opted in, shown only when enough comparable creators exist.
              Nothing identifies any individual, and a small group shows nothing
              at all.
            </p>
            <form action={act.setCohort}>
              <label>
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={
                    cohort ? cohort.reason !== "not_opted_in" : false
                  }
                />{" "}
                Include my follower history in anonymous peer groups, and let me
                see them
              </label>{" "}
              <button className="st-btn">Save</button>
            </form>
            {cohort && cohort.available ? (
              <p>
                For {platformLabel(cohort.platform ?? "")}, follower growth over
                about 90 days among similar-sized creators: lower quartile{" "}
                {cohort.p25}%, median {cohort.median}%, upper quartile{" "}
                {cohort.p75}%.{" "}
                <span className="st-hint">{cohort.limits?.join(" ")}</span>
              </p>
            ) : (
              cohort && (
                <p className="st-hint">
                  {cohort.reason === "cohort_too_small"
                    ? `Not shown: there are not yet enough comparable creators (at least ${cohort.minimum} are required).`
                    : cohort.reason === "not_opted_in"
                      ? "Not shown until you opt in."
                      : "Not shown: no follower history for this platform."}
                </p>
              )
            )}
            {optIn ? null : null}
          </Card>
        </>
      )}
    </main>
  );
}

export async function InsightsView({ sp }: { sp: Params }) {
  const b = await loadBase(sp);
  await syncInsights(b);
  const list = must(
    await analytics.insights(b.ctx.client, b.ctx.workspaceId, true),
  );
  const live = list.filter((i) => i.status !== "stale"),
    stale = list.filter((i) => i.status === "stale");
  const labels: Record<string, string> = {
    growth_opportunity: "Growth opportunity",
    data_quality: "Data quality",
    goal_progress: "Goal progress",
    content_pattern: "Content pattern",
    recommended_experiment: "Recommended experiment",
    observation_update: "Observation update",
    measurement_inconsistency: "Possible measurement inconsistency",
  };
  return (
    <main>
      <h1>Insights</h1>
      <SectionNav current="/creator/analytics/insights" />
      <Notice sp={sp} />
      <p>
        Rule-based findings from your own records, ordered by how much attention
        they deserve. They are not AI output, they do not predict results, and
        they do not add up to a score. {contracts.suspiciousPatterns.reason}
      </p>
      <form action={act.refreshInsights}>
        <button className="st-btn">Refresh from my latest records</button>
      </form>
      {live.length === 0 ? (
        <Missing
          title="No insights yet"
          reason="No rule has enough recorded evidence to produce a finding."
          need="Record follower counts and content metrics. Each finding will show the evidence behind it."
          href="/creator/socials"
          cta="Update accounts"
        />
      ) : (
        <ul className="st-list">
          {live.map((i) => (
            <li key={i.id} className="st-item" data-status={i.status}>
              <p className="st-hint">
                {labels[i.category]} · {i.status} · generated{" "}
                {i.generated_at.slice(0, 10)} · rule {i.rule_key} v
                {i.rule_version} (deterministic)
              </p>
              <h2>{i.title}</h2>
              <p>{i.explanation}</p>
              <details>
                <summary>Evidence</summary>
                <pre style={{ whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(i.evidence, null, 1)}
                </pre>
              </details>
              <Limits items={i.limitations} />
              {i.action && (
                <p>
                  <strong>Next:</strong>{" "}
                  {i.link ? <Link href={i.link}>{i.action}</Link> : i.action}
                </p>
              )}
              {i.category === "content_pattern" ||
              i.category === "recommended_experiment" ? (
                <p>
                  <Link href={`/creator/experiments/new?insight=${i.id}`}>
                    Turn this into an experiment (you decide whether to start
                    it)
                  </Link>
                </p>
              ) : null}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {(["saved", "dismissed", "acted"] as const).map((s) => (
                  <form key={s} action={act.insightStatus}>
                    <input type="hidden" name="insight" value={i.id} />
                    <input type="hidden" name="status" value={s} />
                    <button className="st-btn" disabled={i.status === s}>
                      {s === "saved"
                        ? "Save"
                        : s === "dismissed"
                          ? "Dismiss"
                          : "Mark as acted on"}
                    </button>
                  </form>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {stale.length > 0 && (
        <details>
          <summary>Outdated findings ({stale.length})</summary>
          <p className="st-hint">
            The data behind these changed and the rule no longer applies. They
            are kept for reference and are not current.
          </p>
          <ul>
            {stale.map((i) => (
              <li key={i.id}>
                {i.title} (outdated since {i.status_at.slice(0, 10)})
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}

const statusLabel: Record<string, string> = {
  draft: "Draft",
  planned: "Planned",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};
export async function ExperimentsView({ sp }: { sp: Params }) {
  const b = await loadBase({});
  const list = must(
    await analytics.experiments(b.ctx.client, b.ctx.workspaceId),
  );
  const learned = list.filter((e) => e.status === "completed");
  return (
    <main>
      <h1>Growth Experiment Lab</h1>
      <SectionNav current="/creator/experiments" />
      <Notice sp={sp} />
      <p>
        Small, honest tests of your own ideas. Nothing starts without you,
        nothing is published for you, and results are described, never promised.
        Templates are starting points, not strategies.
      </p>
      <p>
        <Link className="st-btn primary" href="/creator/experiments/new">
          Plan an experiment
        </Link>
      </p>
      {b.allAccounts.length === 0 && (
        <Missing
          title="Experiments need an account to measure"
          reason="An experiment compares recorded numbers from one of your accounts."
          href="/creator/socials/new"
          cta="Add an account"
        />
      )}
      <Card id="all" title="Your experiments">
        {list.length === 0 ? (
          <p>No experiments yet.</p>
        ) : (
          <ul className="st-list">
            {list.map((e) => (
              <li key={e.id} className="st-item">
                <Link href={`/creator/experiments/${e.id}`}>{e.name}</Link> ·{" "}
                {statusLabel[e.status]} · {metricLabel(e.metric)} on{" "}
                {acctLabel(e)}
                {e.outcome
                  ? ` · ${outcomeLabels[e.outcome as keyof typeof outcomeLabels]}`
                  : ""}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card id="learn" title="Learning history">
        {learned.length === 0 ? (
          <p>Completed experiments and what you took from them appear here.</p>
        ) : (
          <ul className="st-list">
            {learned.map((e) => (
              <li key={e.id} className="st-item">
                <strong>{e.name}</strong>
                <p>Hypothesis: {e.hypothesis}</p>
                <p>
                  Outcome:{" "}
                  {outcomeLabels[e.outcome as keyof typeof outcomeLabels]}.{" "}
                  {e.interpretation}
                </p>
                {e.next_experiment && <p>Next: {e.next_experiment}</p>}
                <p className="st-hint">{e.learning_tags.join(", ")}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
const candidatesFor = (
  obs: AccountObs[],
  content: ContentItem[],
  account: string,
  metric: string,
  scope: "account" | "content",
) =>
  scope === "account"
    ? obs
        .filter((o) => o.account_id === account && o.metric === metric)
        .sort((a, b) => b.observed_on.localeCompare(a.observed_on))
        .slice(0, 30)
        .map((o) => ({
          id: o.id,
          label: `${o.observed_on}: ${fmt(o.value)}${o.period_start ? ` (${o.period_start} to ${o.period_end})` : ""} · ${sourceLabel[o.source]}`,
        }))
    : content
        .filter((c) => c.account_id === account)
        .flatMap((c) =>
          c.observations
            .filter((o) => o.metric === metric)
            .map((o) => ({
              id: o.id,
              label: `${c.title ?? c.external_id}, ${o.observed_on}: ${fmt(o.value)}${o.period_start ? ` (${o.period_start} to ${o.period_end})` : " (lifetime)"} · ${sourceLabel[o.source]}`,
            })),
        )
        .slice(0, 40);
export async function ExperimentNewView({ sp }: { sp: Params }) {
  const b = await loadBase({});
  const accounts = b.allAccounts.map((a) => ({
    id: a.id,
    label: acctLabel(a),
  }));
  const tplKey = one(sp, "template");
  const tpl = templates.find((t) => t.key === tplKey);
  const account =
    one(sp, "account") && accounts.some((a) => a.id === one(sp, "account"))
      ? one(sp, "account")!
      : accounts[0]?.id;
  const acc = b.allAccounts.find((a) => a.id === account);
  const available = acc
    ? metricsFor(acc.platform, "account").concat(
        metricsFor(acc.platform, "content"),
      )
    : [];
  const metric =
    one(sp, "metric") && available.some((m) => m.code === one(sp, "metric"))
      ? one(sp, "metric")!
      : tpl && available.some((m) => m.code === tpl.metric)
        ? tpl.metric
        : available[0]?.code;
  const insight = one(sp, "insight");
  const content = account
    ? must(await analytics.content(b.ctx.client, b.ctx.workspaceId, account))
        .content
    : [];
  const def = metrics.find((m) => m.code === metric);
  return (
    <main>
      <p>
        <Link href="/creator/experiments">All experiments</Link>
      </p>
      <h1>Plan an experiment</h1>
      {accounts.length === 0 ? (
        <Missing
          title="Add an account first"
          reason="An experiment compares recorded numbers from one of your accounts."
          href="/creator/socials/new"
          cta="Add an account"
        />
      ) : (
        <>
          <form method="get" aria-label="Choose a starting point">
            <div className="st-field">
              <label htmlFor="n-tpl">Start from a template</label>
              <select id="n-tpl" name="template" defaultValue={tplKey ?? ""}>
                <option value="">Blank experiment</option>
                {templates.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="st-field">
              <label htmlFor="n-acc">Account</label>
              <select id="n-acc" name="account" defaultValue={account}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="st-field">
              <label htmlFor="n-met">Metric</label>
              <select id="n-met" name="metric" defaultValue={metric}>
                {available.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.label} ({m.scope})
                  </option>
                ))}
              </select>
            </div>
            {insight && <input type="hidden" name="insight" value={insight} />}
            <button className="st-btn">Use these</button>
          </form>
          {account && metric && def && (
            <ExperimentForm
              key={`${account}-${metric}-${tplKey}`}
              action={act.createExperiment}
              accounts={accounts}
              account={account}
              metric={metric}
              insight={insight}
              defaults={tpl ?? {}}
              candidates={candidatesFor(
                b.series.observations,
                content,
                account,
                metric,
                def.scope,
              )}
            />
          )}
        </>
      )}
    </main>
  );
}
export async function ExperimentDetailView({
  id,
  sp,
}: {
  id: string;
  sp: Params;
}) {
  const b = await loadBase({});
  const e = must(
    await analytics.experiments(b.ctx.client, b.ctx.workspaceId, id),
  )[0];
  if (!e) notFound();
  const content = must(
    await analytics.content(b.ctx.client, b.ctx.workspaceId, e.account_id),
  ).content;
  const fullSeries = must(
    await analytics.series(
      b.ctx.client,
      b.ctx.workspaceId,
      addDays(b.today, -300),
      b.today,
    ),
  );
  const baselineSnaps = e.baseline?.observations ?? [];
  const m = measure(
    baselineSnaps.map((s) => ({
      ref: s.ref,
      value: s.value,
      observed_on: s.observed_on,
      window_days: s.window_days,
      source: s.source,
    })),
    e.links.map((l) => ({
      ref: l.ref_id,
      value: l.snapshot.value,
      observed_on: l.snapshot.observed_on,
      window_days: l.snapshot.window_days,
      source: l.snapshot.source,
    })),
    e.evaluation_days,
    {
      confounders: e.confounders,
      reassessment: e.links.some((l) => l.current?.corrected_since),
    },
  );
  const candidates =
    e.status === "active"
      ? candidatesFor(
          fullSeries.observations,
          content,
          e.account_id,
          e.metric,
          e.metric_scope,
        ).filter(
          (c) =>
            !e.links.some((l) => l.ref_id === c.id) &&
            !baselineSnaps.some((s) => s.ref === c.id),
        )
      : [];
  const hint = outcomeHint(m);
  return (
    <main>
      <p>
        <Link href="/creator/experiments">All experiments</Link>
      </p>
      <h1>{e.name}</h1>
      <p>
        {statusLabel[e.status]} · {metricLabel(e.metric)} on {acctLabel(e)}
        {e.activated_at ? ` · started ${e.activated_at.slice(0, 10)}` : ""}
        {e.ended_at ? ` · ended ${e.ended_at.slice(0, 10)}` : ""}
      </p>
      <Notice sp={sp} />
      <Card id="plan" title="The plan">
        <p>
          <strong>Hypothesis:</strong> {e.hypothesis}
        </p>
        {e.objective && (
          <p>
            <strong>Objective:</strong> {e.objective}
          </p>
        )}
        {e.planned_change && (
          <p>
            <strong>Planned change:</strong> {e.planned_change}
          </p>
        )}
        {e.measurement_method && (
          <p>
            <strong>Measurement:</strong> {e.measurement_method}
          </p>
        )}
        {e.success_criterion && (
          <p>
            <strong>Success looks like:</strong> {e.success_criterion}
          </p>
        )}
        {e.confounders && (
          <p>
            <strong>Could confuse the result:</strong> {e.confounders}
          </p>
        )}
        <p>
          <strong>Evaluation period:</strong> {e.evaluation_days} days
        </p>
      </Card>
      <Card id="baseline" title="Baseline">
        {e.baseline ? (
          <>
            <p className="st-hint">
              Frozen when the experiment started (
              {e.baseline.frozen_at.slice(0, 10)}). Later corrections do not
              change it.
            </p>
            {e.baseline.observations.length === 0 ? (
              <p>No baseline: {e.baseline.unavailable_reason}</p>
            ) : (
              <ul className="st-list">
                {e.baseline.observations.map((s) => (
                  <li key={s.ref} className="st-item">
                    {fmt(s.value)} on {s.observed_on}
                    {s.window_days
                      ? ` (${s.window_days}-day window)`
                      : ""} · {sourceLabel[s.source as Source]}
                    {s.corrected ? " · was already corrected" : ""}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p>
            {e.baseline_refs.length} baseline observation
            {e.baseline_refs.length === 1 ? "" : "s"} selected.{" "}
            {e.baseline_unavailable_reason
              ? `No baseline: ${e.baseline_unavailable_reason}.`
              : ""}{" "}
            The baseline is frozen when you start.
          </p>
        )}
      </Card>
      {(e.status === "active" ||
        e.status === "completed" ||
        e.links.length > 0) && (
        <Card id="obs" title="Observations and result">
          {e.links.length === 0 ? (
            <p>No observations added yet.</p>
          ) : (
            <ul className="st-list">
              {e.links.map((l) => (
                <li key={l.id} className="st-item">
                  {fmt(l.snapshot.value)} on {l.snapshot.observed_on}
                  {l.snapshot.window_days
                    ? ` (${l.snapshot.window_days}-day window)`
                    : ""}{" "}
                  · {sourceLabel[l.snapshot.source as Source]}
                  {l.current?.corrected_since && (
                    <span className="st-error">
                      {" "}
                      · corrected since to {fmt(l.current.value)}; reassess
                    </span>
                  )}
                  {e.status === "active" && (
                    <form action={act.unlinkObservation}>
                      <input type="hidden" name="link" value={l.id} />
                      <input type="hidden" name="id" value={e.id} />
                      <button className="st-btn">Remove</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {m.status === "ok" ? (
            <div role="group" aria-label="Descriptive comparison">
              <p>
                Median baseline {fmt(m.baseline)} (n={m.baselineN}), median
                observed {fmt(m.observed)} (n={m.observedN}). Difference{" "}
                {signed(m.absolute)}
                {m.relative !== null ? ` (${signed(m.relative)}%)` : ""}:
                observed values are {m.direction} than the baseline.
              </p>
              <p className="st-hint">{m.coverage}</p>
              <Limits items={m.limitations} />
            </div>
          ) : (
            <p className="st-hint">
              {m.status === "no_baseline" ? m.reason : m.reason}
            </p>
          )}
          {e.status === "active" &&
            (candidates.length === 0 ? (
              <p className="st-hint">
                No further recorded observation of this metric qualifies yet. It
                must be the same metric, recorded after the start, with the same
                window as the baseline.
              </p>
            ) : (
              <form
                action={act.linkObservation}
                aria-label="Add an observation"
              >
                <input type="hidden" name="id" value={e.id} />
                <div className="st-field">
                  <label htmlFor="lk">Add a recorded observation</label>
                  <select id="lk" name="ref">
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="st-btn">Add to experiment</button>
              </form>
            ))}
        </Card>
      )}
      <Card id="life" title="Next step">
        {editable(e.status) && (
          <p className="st-hint">
            You can still edit the plan by creating a new draft. A started
            experiment cannot be changed.
          </p>
        )}
        {e.status === "draft" && canMove("draft", "planned") && (
          <form action={act.planExperiment}>
            <input type="hidden" name="id" value={e.id} />
            <button className="st-btn">Mark as planned</button>
          </form>
        )}
        {editable(e.status) && (
          <form action={act.activateExperiment}>
            <input type="hidden" name="id" value={e.id} />
            <p className="st-hint">
              Starting freezes the baseline. AURA does not publish anything for
              you.
            </p>
            <button className="st-btn primary">Start the experiment</button>
          </form>
        )}
        {e.status === "active" && (
          <form
            action={act.completeExperiment}
            aria-label="Complete the experiment"
          >
            <input type="hidden" name="id" value={e.id} />
            <div className="st-field">
              <label htmlFor="oc">Outcome</label>
              <select
                id="oc"
                name="outcome"
                defaultValue={hint ?? "inconclusive"}
              >
                {outcomes.map((o) => (
                  <option key={o} value={o}>
                    {outcomeLabels[o]}
                  </option>
                ))}
              </select>
              <p className="st-hint">
                Pre-selected from the descriptive comparison only as a
                suggestion. Choose what you actually conclude. Inconclusive is a
                good answer.
              </p>
            </div>
            <div className="st-field">
              <label htmlFor="ip">What do you take from it?</label>
              <textarea id="ip" name="interpretation" maxLength={1000} />
            </div>
            <div className="st-field">
              <label htmlFor="nx">Suggested next experiment</label>
              <input id="nx" name="next" maxLength={500} />
            </div>
            <div className="st-field">
              <label htmlFor="tg">Learning tags (comma separated)</label>
              <input id="tg" name="tags" />
            </div>
            <button className="st-btn primary">Complete</button>
          </form>
        )}
        {(e.status === "active" ||
          e.status === "planned" ||
          e.status === "draft") && (
          <form action={act.cancelExperiment}>
            <input type="hidden" name="id" value={e.id} />
            <button className="st-btn">Cancel without a result</button>
          </form>
        )}
        {e.status === "completed" && (
          <p>
            <strong>
              {outcomeLabels[e.outcome as keyof typeof outcomeLabels]}.
            </strong>{" "}
            {e.interpretation}{" "}
            {e.next_experiment && <>Next: {e.next_experiment}</>}
          </p>
        )}
      </Card>
      <Card id="hist" title="History">
        <ul className="st-list">
          {e.events.map((v, i) => (
            <li key={i} className="st-item">
              {v.event.replace(/_/g, " ")} ·{" "}
              {v.at.slice(0, 16).replace("T", " ")}
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}

export async function ReportsView({ sp }: { sp: Params }) {
  const b = await loadBase({});
  const log = must(await analytics.exports(b.ctx.client, b.ctx.workspaceId));
  return (
    <main>
      <h1>Reports and exports</h1>
      <SectionNav current="/creator/analytics/reports" />
      <Notice sp={sp} />
      <p>
        Export your own data as CSV, or a summary as PDF. Each export asks for a
        purpose, is checked against your current access when you press the
        button, and is logged without its contents. Nothing is sent anywhere.
      </p>
      <form
        method="get"
        action="/creator/analytics/reports/download"
        aria-label="Create an export"
        className="st-card"
      >
        <div className="st-field">
          <label htmlFor="r-kind">What to export</label>
          <select id="r-kind" name="kind">
            <option value="summary">
              Summary (what changed and what limits it)
            </option>
            <option value="observations">Account observations</option>
            <option value="content">Content and tags</option>
            <option value="audience">Audience information</option>
            <option value="experiments">Experiments and learning</option>
          </select>
        </div>
        <div className="st-field">
          <label htmlFor="r-format">Format</label>
          <select id="r-format" name="format">
            <option value="csv">CSV</option>
            <option value="pdf">
              PDF (
              {features.reports.tier === "advanced"
                ? "advanced feature, free for now"
                : "free"}
              )
            </option>
          </select>
        </div>
        <div className="st-field">
          <label htmlFor="r-purpose">What is this for?</label>
          <input
            id="r-purpose"
            name="purpose"
            required
            minLength={3}
            maxLength={200}
            aria-describedby="r-purpose-h"
          />
          <p className="st-hint" id="r-purpose-h">
            For example: my own records, or a talk with my manager.
          </p>
        </div>
        <div className="st-field">
          <label htmlFor="r-range">Period (summary)</label>
          <select id="r-range" name="range" defaultValue="30d">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
        <button className="st-btn primary">Create export</button>
      </form>
      <Card id="log" title="Your export log">
        {log.length === 0 ? (
          <p>No exports yet.</p>
        ) : (
          <ul className="st-list">
            {log.map((l) => (
              <li key={l.id} className="st-item">
                {l.at.slice(0, 16).replace("T", " ")} · {l.kind} ·{" "}
                {l.format.toUpperCase()} · {l.purpose}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
export type { Base, Experiment };
