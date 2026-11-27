import Link from "next/link";
import { notFound } from "next/navigation";
import { brandContext } from "@/server/market/service";
import { monitor, type Observation } from "@/server/monitor/service";
import { EntityForm, type FieldDef } from "@/features/creator-profile/forms";
import { CampaignTabs } from "@/features/campaigns/tabs";
import * as act from "./actions";
import {
  deliveryStats,
  exceptionLabels,
  metricCoverage,
  money,
  sectionLabels,
  sources,
  type Collab,
  type Rollup,
  type Section,
} from "./rules";
import "./monitor.css";

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
const num = (n: number) => new Intl.NumberFormat("en-IN").format(n);
const dateOk = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** The form to record a result for any published deliverable in the given collaborations. */
function RecordForm({
  collabs,
  w,
  label,
}: {
  collabs: Collab[];
  w?: string;
  label: string;
}) {
  const targets = Object.fromEntries(
    collabs.flatMap((c) =>
      c.deliverables
        .filter((d) => d.published_on)
        .map((d) => [
          `${c.collaboration_id}|${d.id}`,
          `${c.creator}: ${d.title} (published ${day(d.published_on)})`,
        ]),
    ),
  );
  if (!Object.keys(targets).length)
    return (
      <p className="st-hint">
        Results can be recorded once a deliverable is published.
      </p>
    );
  const metricOptions = {
    views: "Views",
    reach: "Reach",
    impressions: "Impressions",
    likes: "Likes",
    comments: "Comments",
    shares: "Shares",
    saves: "Saves",
    link_clicks: "Link clicks",
    conversions: "Conversions",
  };
  const fields: FieldDef[] = [
    ...(w ? [{ name: "w", label: "", type: "hidden" as const, value: w }] : []),
    {
      name: "target",
      label: "Deliverable",
      type: "select",
      options: targets,
      required: true,
    },
    {
      name: "metric",
      label: "Metric",
      type: "select",
      options: metricOptions,
      required: true,
    },
    { name: "value", label: "Value", type: "number", min: 0, required: true },
    {
      name: "window_kind",
      label: "Counted over",
      type: "select",
      options: {
        lifetime: "Since publication (cumulative)",
        window: "A specific period",
      },
    },
    {
      name: "period_start",
      label: "Period from",
      type: "date",
      showIf: { field: "window_kind", in: ["window"] },
    },
    {
      name: "period_end",
      label: "Period to",
      type: "date",
      showIf: { field: "window_kind", in: ["window"] },
    },
    {
      name: "observed_on",
      label: "Read on",
      type: "date",
      hint: "The date you read the number. Defaults to today.",
    },
    {
      name: "source",
      label: "Source",
      type: "select",
      options: w
        ? sources
        : Object.fromEntries(
            Object.entries(sources).filter(([k]) => k !== "brand_records"),
          ),
      required: true,
    },
    {
      name: "source_note",
      label: "Source note",
      max: 300,
      hint: "For example: Instagram insights, screenshot saved in our drive.",
    },
  ];
  return (
    <EntityForm
      action={act.recordResult}
      label={label}
      idPrefix={w ? "rb" : "rc"}
      submit="Record result"
      fields={fields}
    />
  );
}
function Log({
  items,
  w,
  back,
  defs,
}: {
  items: Observation[];
  w?: string;
  back: string;
  defs: Rollup["metrics"];
}) {
  if (!items.length) return <p className="st-hint">No results recorded yet.</p>;
  return (
    <ul className="mo-log">
      {items.slice(0, 30).map((o) => (
        <li key={o.id} className={o.voided_at ? "void" : ""}>
          <span>
            <b>{defs[o.metric]?.label ?? o.metric}</b> {num(o.value)} ·{" "}
            {o.window_kind === "window"
              ? `${day(o.period_start)} to ${day(o.period_end)}`
              : "cumulative"}{" "}
            · read {day(o.observed_on)}
          </span>
          <span className="st-hint">
            {sources[o.source as keyof typeof sources] ?? o.source}
            {o.source_note ? ` (${o.source_note})` : ""} · entered by{" "}
            {o.side === "brand" ? "the Brand" : "the Creator"}
            {o.voided_at ? ` · voided: ${o.void_reason}` : ""}
          </span>
          {o.mine && !o.voided_at && (
            <form action={act.voidResult} className="mo-void">
              {w && <input type="hidden" name="w" value={w} />}
              <input type="hidden" name="id" value={o.id} />
              <input type="hidden" name="back" value={back} />
              <label className="sr-only" htmlFor={`vr-${o.id}`}>
                Reason for voiding
              </label>
              <input
                id={`vr-${o.id}`}
                name="reason"
                placeholder="Reason"
                maxLength={300}
              />
              <button className="st-btn">Void</button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
function Performance({ r }: { r: Rollup }) {
  const cov = metricCoverage(r);
  const keys = Object.keys(r.totals);
  return (
    <>
      <p className="st-hint">
        Results recorded for <b>{r.coverage.with_results}</b> of{" "}
        <b>{r.coverage.published}</b> published deliverables. Totals use the
        latest cumulative reading per deliverable; repeated readings and time
        windows are never added together. There is no overall score.
      </p>
      {keys.length === 0 ? (
        <p className="mo-empty">No results yet.</p>
      ) : (
        <dl className="mo-totals">
          {keys.map((m) => (
            <div key={m}>
              <dt>{r.metrics[m]?.label ?? m}</dt>
              <dd>{num(r.totals[m])}</dd>
              <dd className="st-hint mo-note">
                From {cov[m] ?? 0} deliverable{cov[m] === 1 ? "" : "s"}.{" "}
                {r.metrics[m]?.definition}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}
function Delivery({ r, w }: { r: Rollup; w?: string }) {
  return (
    <div className="mo-collabs">
      {r.delivery.map((c) => (
        <article key={c.collaboration_id} className="mo-collab">
          <header>
            <h3>{c.creator}</h3>
            <span className="mo-status" data-s={c.status}>
              {c.status}
            </span>
            {c.open_disputes > 0 && (
              <span className="mo-pill no">
                {c.open_disputes} open dispute{c.open_disputes === 1 ? "" : "s"}
              </span>
            )}
            {w && !c.shared && (
              <span className="mo-pill">
                {"Creator's own figures not shared"}
              </span>
            )}
            <Link href={`/collaborations/${c.m12}`} className="mo-open">
              Open workspace
            </Link>
          </header>
          <ul className="mo-dels">
            {c.deliverables.map((d) => (
              <li
                key={d.id}
                className={d.overdue ? "overdue" : d.published_on ? "done" : ""}
              >
                <span className="mo-dot" aria-hidden />
                <span className="mo-del-main">
                  <b>{d.title}</b>{" "}
                  <span className="st-hint">
                    {d.published_on ? (
                      <>
                        published {day(d.published_on)}
                        {d.url ? (
                          <>
                            {" "}
                            ·{" "}
                            <a
                              href={d.url}
                              rel="noopener noreferrer nofollow"
                              target="_blank"
                            >
                              view post
                            </a>
                          </>
                        ) : null}
                      </>
                    ) : (
                      `${d.stage}${d.due ? ` · due ${day(d.due)}` : ""}`
                    )}
                    {d.overdue ? " · overdue" : ""}
                    {d.revisions
                      ? ` · ${d.revisions} revision${d.revisions === 1 ? "" : "s"}`
                      : ""}
                  </span>
                </span>
                {Object.keys(d.results).length > 0 && (
                  <span className="mo-res">
                    {Object.entries(d.results).map(([m, x]) => (
                      <span
                        key={m}
                        title={`${x.source}, read ${x.observed_on}, entered by ${x.side}`}
                        className={x.stale ? "stale" : ""}
                      >
                        {r.metrics[m]?.label ?? m} {num(x.value)}
                      </span>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {c.notes.length > 0 && (
            <p className="st-hint">
              Notes from the collaboration (not counted):{" "}
              {c.notes
                .map((n) => `${n.metric} ${n.value} (${n.period})`)
                .join("; ")}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
function Payments({ r }: { r: Rollup }) {
  return (
    <>
      <p className="st-hint">
        Recorded by the parties in the commercial workspace, not verified by
        AURA. Delivery never implies payment.
      </p>
      <table className="mo-table">
        <thead>
          <tr>
            <th scope="col">Creator</th>
            <th scope="col">Agreed</th>
            <th scope="col">Recorded payments</th>
          </tr>
        </thead>
        <tbody>
          {r.payments.map((p) => (
            <tr key={p.collaboration_id}>
              <td>{p.creator}</td>
              <td>
                {p.agreed
                  ? money(p.agreed.currency, p.agreed.amount)
                  : "Not stated"}
              </td>
              <td>
                {p.recorded.length ? (
                  p.recorded
                    .map(
                      (x) =>
                        `${money(x.currency, x.amount)} ${x.status.toLowerCase()}`,
                    )
                    .join(", ")
                ) : (
                  <span className="st-hint">None recorded</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
function Exceptions({ r, w }: { r: Rollup; w?: string }) {
  if (!r.exceptions.length)
    return <p className="mo-empty ok">Nothing needs attention.</p>;
  return (
    <ul className="mo-exc">
      {r.exceptions.map((e, i) => (
        <li key={i} data-k={e.kind}>
          <span className="mo-pill">{exceptionLabels[e.kind]}</span>{" "}
          <b>{e.creator}</b>
          {e.deliverable ? `, ${e.deliverable}` : ""}: {e.detail}
          {w ? (
            <>
              {" "}
              · <Link href={`/collaborations/${e.m12}`}>open</Link>
            </>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

// ───────── Brand: Monitor tab ─────────
export async function MonitorView({ id, sp }: { id: string; sp: SP }) {
  if (!uuidRe.test(id)) notFound();
  const b = await brandContext(one(sp, "w"));
  const w = b.workspaceId;
  const from = dateOk(one(sp, "from")),
    to = dateOk(one(sp, "to"));
  const r = await monitor.overview(b.client, w, id, from, to);
  if (!r.ok) notFound();
  const o = r.value;
  const s = deliveryStats(o);
  const logs = await Promise.all(
    o.delivery.map((c) =>
      monitor.observations(b.client, w, c.collaboration_id),
    ),
  );
  const all = logs.flatMap((l) => (l.ok ? l.value : []));
  const recorded = o.payments.flatMap((p) => p.recorded);
  return (
    <main className="shell mo-main">
      <CampaignTabs id={id} w={w} current="monitor" />
      <header className="mo-head">
        <div>
          <h1>Monitor · {o.campaign.title}</h1>
          <p className="st-hint">
            Delivery, results and payments, kept apart. Every figure shows where
            it came from.
          </p>
        </div>
        <form className="mo-period" method="get">
          <input type="hidden" name="w" value={w} />
          <label>
            From <input type="date" name="from" defaultValue={from ?? ""} />
          </label>
          <label>
            To <input type="date" name="to" defaultValue={to ?? ""} />
          </label>
          <button className="st-btn">Apply</button>
        </form>
      </header>
      {o.delivery.length === 0 ? (
        <div className="mo-empty big">
          <h2>Nothing to monitor yet</h2>
          <p>
            Collaborations appear here once a Creator and your team confirm the
            same proposal and the collaboration workspace opens.
          </p>
          <Link href={`/brand/campaigns/${id}/applications?w=${w}`}>
            Go to applicants
          </Link>
        </div>
      ) : (
        <>
          <div className="mo-kpis">
            <div>
              <b>
                {s.published}
                <small> / {s.total}</small>
              </b>
              deliverables published
            </div>
            <div className={s.overdue ? "warn" : ""}>
              <b>{s.overdue}</b>overdue
            </div>
            <div>
              <b>
                {o.coverage.with_results}
                <small> / {o.coverage.published}</small>
              </b>
              with results
            </div>
            <div>
              <b>{o.exceptions.length}</b>need attention
            </div>
            <div>
              <b>
                {recorded.length
                  ? recorded
                      .filter((x) => x.status === "Confirmed")
                      .map((x) => money(x.currency, x.amount))
                      .join(" + ") || "None"
                  : "None"}
              </b>
              payments confirmed
            </div>
          </div>
          <div className="mo-grid">
            <section className="st-card mo-span" aria-labelledby="h-exc">
              <h2 id="h-exc">Needs attention</h2>
              <Exceptions r={o} w={w} />
            </section>
            <section className="st-card" aria-labelledby="h-perf">
              <h2 id="h-perf">Performance</h2>
              <Performance r={o} />
            </section>
            <section className="st-card" aria-labelledby="h-pay">
              <h2 id="h-pay">Payments</h2>
              <Payments r={o} />
            </section>
            <section className="st-card mo-span" aria-labelledby="h-del">
              <h2 id="h-del">Delivery</h2>
              <p className="st-hint">
                From each collaboration workspace. Delivery does not mean
                success or payment.
              </p>
              <Delivery r={o} w={w} />
            </section>
            <section className="st-card" aria-labelledby="h-rec">
              <h2 id="h-rec">Record a result</h2>
              <RecordForm collabs={o.delivery} w={w} label="Record a result" />
            </section>
            <section className="st-card" aria-labelledby="h-log">
              <h2 id="h-log">Recorded results</h2>
              <Log
                items={all}
                w={w}
                back={`/brand/campaigns/${id}/monitor?w=${w}`}
                defs={o.metrics}
              />
            </section>
          </div>
        </>
      )}
    </main>
  );
}

// ───────── Brand: reports ─────────
export async function ReportsView({ id, sp }: { id: string; sp: SP }) {
  if (!uuidRe.test(id)) notFound();
  const b = await brandContext(one(sp, "w"));
  const w = b.workspaceId;
  const r = await monitor.reports(b.client, w, id);
  if (!r.ok) notFound();
  return (
    <main className="shell mo-main">
      <CampaignTabs id={id} w={w} current="reports" />
      <header className="mo-head">
        <div>
          <h1>Reports</h1>
          <p className="st-hint">
            Saved, versioned snapshots. Using the same name again creates the
            next version; earlier versions are kept.
          </p>
        </div>
      </header>
      <div className="mo-grid">
        <section className="st-card" aria-labelledby="h-new">
          <h2 id="h-new">New report</h2>
          <EntityForm
            action={act.createReport}
            label="New report"
            idPrefix="nr"
            submit="Create report"
            fields={[
              { name: "w", label: "", type: "hidden", value: w },
              { name: "campaign", label: "", type: "hidden", value: id },
              {
                name: "name",
                label: "Name",
                required: true,
                max: 100,
                hint: "For example: Weekly results",
              },
              { name: "from", label: "From", type: "date" },
              { name: "to", label: "To", type: "date" },
            ]}
          >
            <fieldset className="mo-checks">
              <legend>Sections</legend>
              {(Object.keys(sectionLabels) as Section[]).map((k) => (
                <label key={k}>
                  <input
                    type="checkbox"
                    name="sections"
                    value={k}
                    defaultChecked
                  />{" "}
                  {sectionLabels[k]}
                </label>
              ))}
            </fieldset>
          </EntityForm>
        </section>
        <section className="st-card" aria-labelledby="h-hist">
          <h2 id="h-hist">History</h2>
          {r.value.length === 0 ? (
            <p className="mo-empty">No reports yet.</p>
          ) : (
            <ul className="mo-hist">
              {r.value.map((x) => (
                <li key={x.id}>
                  <Link href={`/brand/campaigns/${id}/reports/${x.id}?w=${w}`}>
                    {x.name}
                  </Link>{" "}
                  <span className="mo-pill">v{x.version}</span>
                  {x.withdrawn && (
                    <span className="mo-pill no">Figures withdrawn</span>
                  )}
                  <span className="st-hint">
                    {x.sections.map((s) => sectionLabels[s]).join(", ")}
                    {x.from || x.to
                      ? ` · ${day(x.from) || "start"} to ${day(x.to) || "today"}`
                      : ""}{" "}
                    · {x.author} · {day(x.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
export async function ReportView({
  id,
  rid,
  sp,
}: {
  id: string;
  rid: string;
  sp: SP;
}) {
  if (!uuidRe.test(id) || !uuidRe.test(rid)) notFound();
  const b = await brandContext(one(sp, "w"));
  const w = b.workspaceId;
  const r = await monitor.report(b.client, w, rid, "view");
  if (!r.ok) notFound();
  const x = r.value;
  return (
    <main className="shell mo-main">
      <CampaignTabs id={id} w={w} current="reports" />
      {x.blocked ? (
        <div className="mo-empty big">
          <h1>This report can no longer be opened</h1>
          <p>{x.reason}</p>
          <Link href={`/brand/campaigns/${id}/reports?w=${w}`}>
            Back to reports
          </Link>
        </div>
      ) : (
        <article className="mo-report">
          {one(sp, "created") && (
            <p role="status" className="st-ok">
              Report saved as version {x.version}.
            </p>
          )}
          <header className="mo-head">
            <div>
              <p className="mo-eyebrow">
                {x.snapshot.campaign.title} · version {x.version}
              </p>
              <h1>{x.name}</h1>
              <p className="st-hint">
                Generated{" "}
                {new Date(x.created_at).toLocaleString("en-IN", {
                  timeZone: "UTC",
                })}{" "}
                UTC
                {x.from || x.to
                  ? ` · period ${day(x.from) || "start"} to ${day(x.to) || "today"}`
                  : ""}
              </p>
            </div>
            <div className="mo-dl">
              <a
                className="st-btn"
                href={`/brand/campaigns/${id}/reports/${rid}/download?format=csv&w=${w}`}
              >
                Download CSV
              </a>
              <a
                className="st-btn"
                href={`/brand/campaigns/${id}/reports/${rid}/download?format=pdf&w=${w}`}
              >
                Download PDF
              </a>
            </div>
          </header>
          {x.sections.includes("exceptions") && (
            <section aria-labelledby="r-exc">
              <h2 id="r-exc">Needs attention</h2>
              <Exceptions r={x.snapshot} />
            </section>
          )}
          {x.sections.includes("performance") && (
            <section aria-labelledby="r-perf">
              <h2 id="r-perf">Performance</h2>
              <Performance r={x.snapshot} />
            </section>
          )}
          {x.sections.includes("delivery") && (
            <section aria-labelledby="r-del">
              <h2 id="r-del">Delivery</h2>
              <Delivery r={x.snapshot} />
            </section>
          )}
          {x.sections.includes("payments") && (
            <section aria-labelledby="r-pay">
              <h2 id="r-pay">Payments</h2>
              <Payments r={x.snapshot} />
            </section>
          )}
        </article>
      )}
    </main>
  );
}

// ───────── Creator: results for their own collaboration ─────────
export async function CreatorResults({
  client,
  ws,
  collab,
}: {
  client: Parameters<typeof monitor.creator>[0];
  ws: string;
  collab: string;
}) {
  const r = await monitor.creator(client, ws, collab);
  if (!r.ok || r.value.delivery.length === 0) return null;
  const v = r.value;
  return (
    <section
      className="st-card mo-creator"
      id="results"
      aria-labelledby="h-results"
    >
      <h2 id="h-results">Results</h2>
      <p className="st-hint">
        Record how your published posts are doing. Each figure shows its source,
        the date you read it and who entered it. The Brand can record figures
        too.
      </p>
      <Delivery r={v} />
      <Performance r={v} />
      <div className="mo-share">
        <p>
          {v.shared
            ? "Your figures are shared with the Brand's reports."
            : "Your figures are not shared: the Brand's reports exclude them and older reports that used them can no longer be opened."}
        </p>
        <form action={act.setSharing}>
          <input type="hidden" name="collab" value={collab} />
          <input type="hidden" name="share" value={v.shared ? "no" : "yes"} />
          <button className="st-btn">
            {v.shared ? "Stop sharing my figures" : "Share my figures again"}
          </button>
        </form>
      </div>
      <h3>Record a result</h3>
      <RecordForm collabs={v.delivery} label="Record a result for your post" />
      <h3>Recorded results</h3>
      <Log
        items={v.observations}
        back={`/creator/negotiations/${collab}#results`}
        defs={v.metrics}
      />
    </section>
  );
}
