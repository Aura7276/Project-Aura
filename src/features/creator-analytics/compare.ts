import { daysBetween } from "./periods";
import type { ContentItem, ContentObs } from "./types";
import { metricOf } from "@/features/creator-social/metrics";
// Comparing content. Two items are compared only when the numbers mean the same thing. Otherwise the comparison is blocked with the exact reason.
export type Basis =
  | { kind: "lifetime"; ageDays: number | null }
  | { kind: "window"; days: number };
export type Row = {
  item: ContentItem;
  obs: ContentObs | null;
  basis: Basis | null;
};
export const basisOf = (item: ContentItem, o: ContentObs): Basis =>
  o.window_kind === "window"
    ? { kind: "window", days: daysBetween(o.period_start!, o.period_end!) + 1 }
    : {
        kind: "lifetime",
        ageDays: item.published_on
          ? daysBetween(item.published_on, o.observed_on)
          : null,
      };
export const latestOf = (
  item: ContentItem,
  metric: string,
  kind?: "lifetime" | "window",
) =>
  item.observations
    .filter((o) => o.metric === metric && (!kind || o.window_kind === kind))
    .sort((a, b) => a.observed_on.localeCompare(b.observed_on))
    .at(-1) ?? null;
export type Comparison =
  | {
      comparable: false;
      reasons: string[];
      alternative: string | null;
      rows: Row[];
    }
  | {
      comparable: true;
      basisLabel: string;
      rows: (Row & { rank: number })[];
      notes: string[];
      reading: string;
    };
export function compareContent(
  items: ContentItem[],
  metric: string,
): Comparison {
  const def = metricOf(metric);
  const reasons: string[] = [];
  if (items.length < 2)
    return {
      comparable: false,
      reasons: ["Choose at least two content items."],
      alternative: null,
      rows: [],
    };
  if (!def || def.scope !== "content")
    return {
      comparable: false,
      reasons: ["That metric is not a content metric."],
      alternative: null,
      rows: [],
    };
  // prefer the most common basis (a fixed-length window first); each item contributes the observation matching it
  const windows = items
    .map((i) => latestOf(i, metric, "window"))
    .filter(Boolean) as ContentObs[];
  const lengths = windows.map(
    (o) => daysBetween(o.period_start!, o.period_end!) + 1,
  );
  const modeLen = [...new Set(lengths)].sort(
    (a, b) =>
      lengths.filter((x) => x === b).length -
      lengths.filter((x) => x === a).length,
  )[0];
  const rows: Row[] = items.map((item) => {
    const w = item.observations
      .filter(
        (o) =>
          o.metric === metric &&
          o.window_kind === "window" &&
          daysBetween(o.period_start!, o.period_end!) + 1 === modeLen,
      )
      .sort((a, b) => a.observed_on.localeCompare(b.observed_on))
      .at(-1);
    const o =
      modeLen !== undefined ? (w ?? null) : latestOf(item, metric, "lifetime");
    return { item, obs: o, basis: o ? basisOf(item, o) : null };
  });
  const platforms = new Set(items.map((i) => i.platform));
  if (platforms.size > 1)
    reasons.push(
      `These items are on different platforms (${[...platforms].join(", ")}). Each platform defines ${def.label.toLowerCase()} differently, so the numbers do not mean the same thing.`,
    );
  const missing = rows.filter((r) => !r.obs);
  if (missing.length)
    reasons.push(
      `No comparable ${def.label.toLowerCase()} is recorded for: ${missing.map((r) => r.item.title ?? r.item.external_id).join(", ")}.`,
    );
  const mixed =
    items.some((i) => latestOf(i, metric, "lifetime")) &&
    items.some((i) => latestOf(i, metric, "window")) &&
    modeLen !== undefined &&
    rows.some((r) => !r.obs);
  if (mixed)
    reasons.push(
      "Some items only have lifetime totals and others only have windowed totals. A lifetime total and a 7-day total are not comparable.",
    );
  const present = rows.filter((r) => r.obs);
  if (modeLen === undefined && present.length >= 2) {
    const ages = present.map(
      (r) => (r.basis as Extract<Basis, { kind: "lifetime" }>).ageDays,
    );
    if (ages.some((a) => a === null))
      reasons.push(
        "Lifetime totals need each item's publication date to judge content age. Add the publication date.",
      );
    else {
      const lo = Math.min(...(ages as number[])),
        hi = Math.max(...(ages as number[]));
      if (hi - lo > Math.max(3, Math.round(hi * 0.25)))
        reasons.push(
          `The lifetime totals were recorded at very different content ages (${lo} to ${hi} days after publishing). An older item has simply had longer to collect ${def.label.toLowerCase()}.`,
        );
    }
  }
  if (reasons.length)
    return {
      comparable: false,
      reasons,
      rows,
      alternative:
        modeLen === undefined
          ? "Record the same fixed window for each item (for example the first 7 days after publishing), or record lifetime totals when the items are of a similar age."
          : "Record the same window length for the missing items.",
    };
  const sorted = [...present].sort((a, b) => b.obs!.value - a.obs!.value);
  const notes: string[] = [];
  const sources = new Set(present.flatMap((r) => r.obs!.source));
  if (sources.size > 1)
    notes.push("The values come from different source types.");
  if (present.some((r) => r.obs!.corrected))
    notes.push("At least one value has been corrected.");
  const basisLabel =
    modeLen !== undefined
      ? `${modeLen}-day window totals`
      : "lifetime totals at a similar content age";
  return {
    comparable: true,
    basisLabel,
    notes,
    rows: sorted.map((r) => ({ ...r, rank: sorted.indexOf(r) + 1 })),
    reading: `On ${def.label.toLowerCase()} (${basisLabel}) the order observed is shown below. This describes these items only; it does not show why they differ.`,
  };
}
