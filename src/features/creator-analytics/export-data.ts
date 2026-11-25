import "server-only";
import { analytics, type Experiment } from "@/server/analytics/service";
import { must } from "@/server/analytics/load";
import type { StudioContext } from "@/server/studio/service";
import { generateInsights } from "./insights";
import { netGrowth, toPoints } from "./growth";
import { resolveRange, type RangeKey } from "./periods";
import { toCsv, toPdf } from "./exports";
import { metricLabel } from "@/features/creator-social/metrics";
import { sourceLabel, type Source } from "./types";

export type ExportKind =
  "summary" | "observations" | "content" | "audience" | "experiments";
export async function buildExport(
  ctx: StudioContext,
  kind: ExportKind,
  format: "csv" | "pdf",
  rangeKey: string,
  purpose: string,
) {
  const c = ctx.client,
    ws = ctx.workspaceId,
    today = ctx.prefs.today;
  const key = (["7d", "30d", "90d"] as string[]).includes(rangeKey)
    ? (rangeKey as RangeKey)
    : "30d";
  const r = resolveRange(key, today);
  if (!r.ok) throw new Error("range");
  const stamp = `${today}`;
  const header = (what: string) => [
    `AURA ${what}`,
    `Created ${today} for: ${purpose}`,
    "Self-reported unless a source says otherwise. Unknown is shown as blank, never as zero.",
    "",
  ];
  const series = must(
    await analytics.series(c, ws, r.previous.start, r.current.end),
  );
  const label = (id: string) => {
    const a = series.accounts.find((x) => x.id === id);
    return a ? `${a.platform}:@${a.handle}` : id;
  };
  let rows: unknown[][] = [],
    head: string[] = [],
    lines: string[] = [];
  if (kind === "observations") {
    head = [
      "account",
      "metric",
      "value",
      "observed_on",
      "period_start",
      "period_end",
      "source",
      "corrected",
      "evidence_attached",
    ];
    rows = series.observations.map((o) => [
      label(o.account_id),
      o.metric,
      o.value,
      o.observed_on,
      o.period_start ?? "",
      o.period_end ?? "",
      sourceLabel[o.source as Source],
      o.corrected ? "yes" : "no",
      o.has_evidence ? "yes" : "no",
    ]);
    lines = rows.map(
      (x) =>
        `${x[3]}  ${x[0]}  ${metricLabel(String(x[1]))}: ${x[2]}  (${x[6]}${x[7] === "yes" ? ", corrected" : ""})`,
    );
  } else if (kind === "content") {
    const content = must(await analytics.content(c, ws, null)).content;
    head = [
      "account",
      "title_or_id",
      "format",
      "published_on",
      "metric",
      "value",
      "window",
      "observed_on",
      "source",
      "tags",
    ];
    rows = content.flatMap((i) =>
      (i.observations.length ? i.observations : [null]).map((o) => [
        label(i.account_id),
        i.title ?? i.external_id,
        i.format ?? "",
        i.published_on ?? "",
        o ? o.metric : "",
        o ? o.value : "",
        o
          ? o.window_kind === "lifetime"
            ? "lifetime"
            : `${o.period_start}..${o.period_end}`
          : "",
        o?.observed_on ?? "",
        o ? sourceLabel[o.source as Source] : "",
        i.tags
          .filter((t) => t.status === "confirmed")
          .map((t) => `${t.kind}:${t.value}`)
          .join("; "),
      ]),
    );
    lines = rows.map(
      (x) =>
        `${x[1]} (${x[0]}) ${x[4] ? `${metricLabel(String(x[4]))}: ${x[5]} ${x[6]}` : "no metrics recorded"}`,
    );
  } else if (kind === "audience") {
    const aud = must(await analytics.audience(c, ws)).snapshots;
    head = [
      "account",
      "dimension",
      "group",
      "percent",
      "observed_on",
      "denominator_kind",
      "coverage_percent",
      "source",
    ];
    rows = aud.flatMap((s) =>
      s.buckets.map((b) => [
        label(s.account_id),
        s.dimension,
        b.bucket,
        b.share,
        s.observed_on,
        s.denominator_kind,
        s.coverage_pct ?? "",
        sourceLabel[s.source as Source],
      ]),
    );
    lines = rows.map((x) => `${x[1]} ${x[2]}: ${x[3]}%  (${x[0]}, ${x[4]})`);
  } else if (kind === "experiments") {
    const ex: Experiment[] = must(await analytics.experiments(c, ws));
    head = [
      "name",
      "status",
      "account",
      "metric",
      "hypothesis",
      "outcome",
      "interpretation",
      "baseline_values",
      "observed_values",
    ];
    rows = ex.map((e) => [
      e.name,
      e.status,
      `${e.platform}:@${e.handle}`,
      e.metric,
      e.hypothesis,
      e.outcome ?? "",
      e.interpretation ?? "",
      (e.baseline?.observations ?? []).map((s) => s.value).join("; "),
      e.links.map((l) => l.snapshot.value).join("; "),
    ]);
    lines = ex.map(
      (e) =>
        `${e.name} [${e.status}] ${e.outcome ?? "no outcome"}: ${e.hypothesis}`,
    );
  } else {
    head = [
      "account",
      "net_change",
      "baseline_date",
      "latest_date",
      "days_covered",
      "period_days",
    ];
    rows = series.accounts.map((a) => {
      const g = netGrowth(
        toPoints(series.observations, a.id, "followers"),
        r.current,
      );
      return g.status === "unavailable"
        ? [label(a.id), "", "", "", "", g.periodDays]
        : [
            label(a.id),
            g.net,
            g.baseline.date,
            g.latest.date,
            g.coveredDays,
            g.periodDays,
          ];
    });
    const content = must(await analytics.content(c, ws, null)).content;
    const ins = generateInsights({
      today,
      period: r.current,
      previous: r.previous,
      accounts: series.accounts,
      observations: series.observations,
      content,
      hasActiveExperiment: false,
    });
    lines = [
      `Period ${r.current.start} to ${r.current.end} (${r.current.days} days, both ends included).`,
      "",
      "Net audience change by account:",
      ...rows.map((x) =>
        x[1] === ""
          ? `- ${x[0]}: not available (not enough recorded observations)`
          : `- ${x[0]}: ${x[1]} between ${x[2]} and ${x[3]} (${x[4]} of ${x[5]} days covered)`,
      ),
      "",
      "Rule-based findings (not AI, not a score):",
      ...(ins.length
        ? ins
            .slice(0, 8)
            .flatMap((i) => [
              `- ${i.title}`,
              `  ${i.explanation}`,
              `  Limits: ${i.limitations.join(" ")}`,
            ])
        : ["- None: not enough recorded evidence."]),
    ];
  }
  if (format === "csv")
    return {
      type: "text/csv; charset=utf-8",
      name: `aura-${kind}-${stamp}.csv`,
      body: toCsv(head, rows),
    };
  return {
    type: "application/pdf",
    name: `aura-${kind}-${stamp}.pdf`,
    body: toPdf(`AURA ${kind} report`, [...header(kind), ...lines]),
  };
}
