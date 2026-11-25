import { addDays, daysBetween, inPeriod, type Period } from "./periods";
import type { AccountObs } from "./types";
// Net growth for POINT-IN-TIME metrics (followers, following). The documented baseline rule is below. Nothing is interpolated:
// every number shown is a recorded observation and its real date is returned.
export type Point = { id: string; value: number; date: string; source: AccountObs["source"]; corrected: boolean };
export const toPoints = (obs: AccountObs[], account: string, metric: string): Point[] =>
  obs.filter((o) => o.account_id === account && o.metric === metric && o.period_start === null)
    .sort((a, b) => a.observed_on.localeCompare(b.observed_on) || a.entered_at.localeCompare(b.entered_at))
    .map((o) => ({ id: o.id, value: o.value, date: o.observed_on, source: o.source, corrected: o.corrected }));
export const tolerance = (periodDays: number) => Math.min(14, Math.max(3, Math.floor(periodDays / 4)));
export type Growth =
  | { status: "unavailable"; reason: string; need: string; periodDays: number }
  | { status: "ok" | "partial"; baseline: Point; latest: Point; net: number; pct: number | null; pctNote: string | null; coveredDays: number; periodDays: number; coverage: number; perDay: number; notes: string[] };
/**
 * Baseline: the LATEST observation on or before the period start, no more than `tolerance` days earlier; otherwise the EARLIEST observation
 * inside the period within `tolerance` days after the start (its real date is shown). Latest: the last observation inside the period after the baseline.
 * Percentage growth only with a known baseline greater than zero.
 */
export function netGrowth(points: Point[], period: Period): Growth {
  const tol = tolerance(period.days);
  const before = points.filter((p) => p.date <= period.start && daysBetween(p.date, period.start) <= tol).at(-1);
  const after = before ? undefined : points.find((p) => p.date > period.start && p.date <= period.end && daysBetween(period.start, p.date) <= tol);
  const baseline = before ?? after;
  if (!baseline) return { status: "unavailable", periodDays: period.days, reason: `No observation within ${tol} days of ${period.start}.`, need: `Record the number as of about ${period.start}, then record it again near ${period.end}.` };
  const latest = points.filter((p) => inPeriod(p.date, period) && p.date > baseline.date).at(-1);
  if (!latest) return { status: "unavailable", periodDays: period.days, reason: "There is a starting observation but no later one inside this period.", need: `Record the current number to compare with ${baseline.date}.` };
  const covered = daysBetween(baseline.date, latest.date);
  const coverage = Math.min(1, covered / Math.max(1, period.days - 1));
  const notes: string[] = [];
  if (baseline.date > period.start) notes.push(`The starting observation is from ${baseline.date}, ${daysBetween(period.start, baseline.date)} day(s) after the period began.`);
  if (baseline.date < period.start) notes.push(`The starting observation is from ${baseline.date}, before the period began.`);
  if (daysBetween(latest.date, period.end) > tol) notes.push(`The latest observation is from ${latest.date}, ${daysBetween(latest.date, period.end)} day(s) before the period ended.`);
  const net = latest.value - baseline.value;
  const pct = baseline.value > 0 ? Math.round((net / baseline.value) * 10000) / 100 : null;
  return {
    status: coverage >= 0.75 ? "ok" : "partial", baseline, latest, net, pct,
    pctNote: pct === null ? (baseline.value === 0 ? "Percentage growth is not calculated because the starting value is zero." : null) : null,
    coveredDays: covered, periodDays: period.days, coverage, perDay: covered > 0 ? net / covered : 0, notes,
  };
}
export type PeriodComparison =
  | { status: "blocked"; reasons: string[] }
  | { status: "comparable" | "caution"; currentNet: number; previousNet: number; change: number; notes: string[] };
/** Per-day rates are compared only when both periods are covered to a similar extent. Otherwise the comparison is blocked and says why. */
export function comparePeriods(cur: Growth, prev: Growth): PeriodComparison {
  const reasons: string[] = [];
  if (cur.status === "unavailable") reasons.push(`Current period: ${cur.reason}`);
  if (prev.status === "unavailable") reasons.push(`Previous period: ${prev.reason}`);
  if (reasons.length) return { status: "blocked", reasons };
  const c = cur as Extract<Growth, { baseline: Point }>, p = prev as Extract<Growth, { baseline: Point }>;
  const ratio = c.coveredDays === 0 || p.coveredDays === 0 ? 0 : c.coveredDays / p.coveredDays;
  if (ratio < 0.6 || ratio > 1 / 0.6) return { status: "blocked", reasons: [`The two periods are covered very differently (${c.coveredDays} days of observations against ${p.coveredDays}). Comparing them would mislead.`] };
  const notes: string[] = [];
  if (c.status === "partial" || p.status === "partial") notes.push("At least one period is only partly covered by observations. Net change is shown per observed day.");
  if (c.periodDays !== p.periodDays) notes.push("The periods have different lengths.");
  return { status: notes.length ? "caution" : "comparable", currentNet: c.net, previousNet: p.net, change: c.net - p.net, notes };
}
/** Interval metrics (reach, impressions, interactions...) recorded over a period. */
export type IntervalTotal =
  | { status: "unavailable"; reason: string; need: string }
  | { status: "ok" | "partial"; total: number; coveredDays: number; periodDays: number; windows: { id: string; start: string; end: string; value: number; source: AccountObs["source"] }[]; notes: string[] };
export function intervalTotal(obs: AccountObs[], account: string, metric: string, period: Period, opts: { summable: boolean }): IntervalTotal {
  const rows = obs.filter((o) => o.account_id === account && o.metric === metric && o.period_start && o.period_end && o.period_start >= period.start && o.period_end <= period.end)
    .sort((a, b) => a.period_start!.localeCompare(b.period_start!) || b.entered_at.localeCompare(a.entered_at));
  if (!rows.length) return { status: "unavailable", reason: `No ${metric.replace(/_/g, " ")} was recorded over a window inside ${period.start} to ${period.end}.`, need: "Record the platform's figure with its start and end dates." };
  if (!opts.summable) {
    // Unique counts (reach) can only be reported for ONE window that matches the period exactly.
    const exact = rows.find((r) => r.period_start === period.start && r.period_end === period.end);
    if (!exact) return { status: "unavailable", reason: "Unique counts such as reach cannot be added across windows. Only a window matching this period exactly can be used.", need: `Record reach for ${period.start} to ${period.end}.` };
    return { status: "ok", total: exact.value, coveredDays: period.days, periodDays: period.days, windows: [{ id: exact.id, start: exact.period_start!, end: exact.period_end!, value: exact.value, source: exact.source }], notes: [] };
  }
  const used: typeof rows = [];
  let lastEnd = addDays(period.start, -1);
  for (const r of rows) if (r.period_start! > lastEnd) { used.push(r); lastEnd = r.period_end!; }
  const covered = used.reduce((n, r) => n + daysBetween(r.period_start!, r.period_end!) + 1, 0);
  const notes: string[] = [];
  if (used.length < rows.length) notes.push("Overlapping windows were skipped so that no day is counted twice.");
  if (covered < period.days) notes.push(`Recorded windows cover ${covered} of ${period.days} days. The total is for those days only.`);
  return { status: covered >= period.days ? "ok" : "partial", total: used.reduce((n, r) => n + r.value, 0), coveredDays: covered, periodDays: period.days, notes,
    windows: used.map((r) => ({ id: r.id, start: r.period_start!, end: r.period_end!, value: r.value, source: r.source })) };
}
