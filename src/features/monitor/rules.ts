// M19 presentation rules: coverage per metric, exception labels and report exports. Figures come from the database roll-up,
// which already applies the "latest cumulative value per deliverable" rule; nothing here adds readings together again.
import { toCsv } from "@/features/creator-analytics/exports";

export type MetricDef = {
  label: string;
  definition: string;
  unit: string;
  not_unique?: boolean;
};
export type Result = {
  value: number;
  observed_on: string;
  source: string;
  side: "brand" | "creator";
  stale: boolean;
};
export type Deliverable = {
  id: string;
  title: string;
  format: string;
  stage: string;
  review: string | null;
  due: string;
  overdue: boolean;
  published_on: string | null;
  url: string | null;
  revisions: number;
  submissions: number;
  results: Record<string, Result>;
  windows: {
    metric: string;
    value: number;
    from: string;
    to: string;
    source: string;
    side: string;
  }[];
};
export type Collab = {
  collaboration_id: string;
  m12: string;
  creator: string;
  status: string;
  completed: boolean;
  deliverables: Deliverable[];
  open_disputes: number;
  shared: boolean;
  notes: { metric: string; value: string; period: string; source: string }[];
};
export type Payment = {
  collaboration_id: string;
  creator: string;
  agreed: { currency: string; amount: number } | null;
  recorded: { currency: string; status: string; amount: number }[];
};
export type Exception = {
  kind:
    "overdue" | "revisions" | "dispute" | "no_results" | "stale" | "agreement";
  creator: string;
  deliverable: string | null;
  detail: string;
  m12: string;
};
export type Rollup = {
  delivery: Collab[];
  payments: Payment[];
  exceptions: Exception[];
  totals: Record<string, number>;
  metrics: Record<string, MetricDef>;
  coverage: { published: number; with_results: number };
  period: { from: string | null; to: string | null };
  generated_at: string;
};
export const sources = {
  platform_insights: "Platform insights",
  screenshot: "Screenshot of insights",
  platform_export: "Platform export",
  brand_records: "Brand's own records",
  other: "Other",
} as const;
export const exceptionLabels: Record<Exception["kind"], string> = {
  overdue: "Overdue",
  revisions: "Revision loop",
  dispute: "Open dispute",
  no_results: "No results yet",
  stale: "Results out of date",
  agreement: "Agreement pending",
};
export const sectionLabels = {
  delivery: "Delivery",
  performance: "Performance",
  payments: "Payments",
  exceptions: "Exceptions",
} as const;
export type Section = keyof typeof sectionLabels;

/** How many published deliverables each total is based on (coverage shown next to every figure). */
export function metricCoverage(r: Rollup): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of r.delivery)
    for (const d of c.deliverables)
      for (const m of Object.keys(d.results)) out[m] = (out[m] ?? 0) + 1;
  return out;
}
export function deliveryStats(r: Rollup) {
  const all = r.delivery.flatMap((c) => c.deliverables);
  return {
    total: all.length,
    published: all.filter((d) => d.published_on).length,
    overdue: all.filter((d) => d.overdue).length,
    approved: all.filter((d) => d.review === "Approved").length,
  };
}
const fmt = (n: number) => new Intl.NumberFormat("en-IN").format(n);
export const money = (currency: string, amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

/** CSV rows for a report: one row per deliverable and metric, with source, date and who entered it, plus the totals. */
export function reportCsv(r: Rollup, sections: Section[]): string {
  const rows: unknown[][] = [];
  if (sections.includes("performance")) {
    for (const c of r.delivery)
      for (const d of c.deliverables)
        for (const [m, x] of Object.entries(d.results))
          rows.push([
            "result",
            c.creator,
            d.title,
            r.metrics[m]?.label ?? m,
            x.value,
            "lifetime (latest)",
            x.observed_on,
            x.source,
            x.side,
          ]);
    for (const [m, v] of Object.entries(r.totals))
      rows.push([
        "total",
        "",
        "",
        r.metrics[m]?.label ?? m,
        v,
        r.metrics[m]?.not_unique
          ? "sum of per-post values (not unique people)"
          : "sum of latest per deliverable",
        "",
        "",
        "",
      ]);
  }
  if (sections.includes("delivery"))
    for (const c of r.delivery)
      for (const d of c.deliverables)
        rows.push([
          "delivery",
          c.creator,
          d.title,
          d.stage,
          d.published_on ?? "",
          d.overdue ? "overdue" : "",
          d.due,
          `${d.revisions} revisions`,
          c.status,
        ]);
  if (sections.includes("payments"))
    for (const p of r.payments) {
      rows.push([
        "agreed",
        p.creator,
        "",
        p.agreed?.currency ?? "",
        p.agreed?.amount ?? "",
        "agreed in the negotiation",
        "",
        "",
        "",
      ]);
      for (const x of p.recorded)
        rows.push([
          "recorded payment",
          p.creator,
          "",
          x.currency,
          x.amount,
          x.status,
          "",
          "recorded by the parties, not verified by AURA",
          "",
        ]);
    }
  if (sections.includes("exceptions"))
    for (const e of r.exceptions)
      rows.push([
        "exception",
        e.creator,
        e.deliverable ?? "",
        exceptionLabels[e.kind],
        "",
        e.detail,
        "",
        "",
        "",
      ]);
  return toCsv(
    [
      "section",
      "creator",
      "deliverable",
      "metric or item",
      "value",
      "basis",
      "date",
      "source",
      "entered by",
    ],
    rows,
  );
}
/** Plain lines for the PDF export (the PDF writer wraps them). */
export function reportLines(
  title: string,
  r: Rollup,
  sections: Section[],
  meta: { name: string; version: number },
): string[] {
  const l: string[] = [
    `${meta.name} (version ${meta.version}) - ${title}`,
    `Generated ${r.generated_at.slice(0, 16).replace("T", " ")} UTC${r.period.from || r.period.to ? ` - period ${r.period.from ?? "start"} to ${r.period.to ?? "today"}` : ""}`,
    "",
  ];
  const cov = metricCoverage(r);
  if (sections.includes("performance")) {
    l.push(
      "PERFORMANCE",
      `Results recorded for ${r.coverage.with_results} of ${r.coverage.published} published deliverables.`,
    );
    for (const [m, v] of Object.entries(r.totals))
      l.push(
        `${r.metrics[m]?.label ?? m}: ${fmt(v)} (from ${cov[m] ?? 0} deliverables)${r.metrics[m]?.not_unique ? " - not unique people" : ""}`,
      );
    l.push(
      "Totals use the latest cumulative reading per deliverable; repeated readings and time windows are not added together. There is no overall score.",
      "",
    );
  }
  if (sections.includes("delivery")) {
    const s = deliveryStats(r);
    l.push(
      "DELIVERY",
      `${s.published} of ${s.total} deliverables published; ${s.overdue} overdue; ${s.approved} approved.`,
    );
    for (const c of r.delivery)
      l.push(
        `${c.creator} - ${c.status}: ${c.deliverables.map((d) => `${d.title} (${d.published_on ? `published ${d.published_on}` : d.stage})`).join("; ")}`,
      );
    l.push("Delivery does not mean payment or success.", "");
  }
  if (sections.includes("payments")) {
    l.push("PAYMENTS (recorded by the parties, not verified by AURA)");
    for (const p of r.payments)
      l.push(
        `${p.creator}: agreed ${p.agreed ? money(p.agreed.currency, p.agreed.amount) : "not stated"}; recorded ${p.recorded.length ? p.recorded.map((x) => `${money(x.currency, x.amount)} ${x.status.toLowerCase()}`).join(", ") : "none"}`,
      );
    l.push("");
  }
  if (sections.includes("exceptions")) {
    l.push("EXCEPTIONS");
    if (!r.exceptions.length) l.push("None.");
    for (const e of r.exceptions)
      l.push(
        `${exceptionLabels[e.kind]}: ${e.creator}${e.deliverable ? `, ${e.deliverable}` : ""} - ${e.detail}`,
      );
  }
  return l;
}
