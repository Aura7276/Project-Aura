import { metricOf } from "./metrics";
export type Freshness = {
  state: "current" | "stale" | "unknown" | "unavailable";
  days: number | null;
  label: string;
  recommendation: string | null;
};
const MS = 86_400_000;
export const daysBetween = (from: string, to: string) =>
  Math.floor(
    (Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / MS,
  );
/**
 * Metric-specific, never a single universal threshold. `unknown`: nothing was ever recorded. `unavailable`: the metric does not exist for
 * this platform. A disconnected account's numbers are historical and are never described as current.
 */
export function freshness(
  metric: string,
  platform: string,
  observedOn: string | null,
  today: string,
  opts: { disconnected?: boolean } = {},
): Freshness {
  const m = metricOf(metric);
  if (!m || !m.platforms.includes(platform))
    return {
      state: "unavailable",
      days: null,
      label: "Not available for this platform",
      recommendation: null,
    };
  if (!observedOn)
    return {
      state: "unknown",
      days: null,
      label: "Nothing recorded yet",
      recommendation: `Record your ${m.label.toLowerCase()} to start your history.`,
    };
  const days = Math.max(0, daysBetween(observedOn, today));
  if (opts.disconnected)
    return {
      state: "stale",
      days,
      label: `Historical, from ${days} day${days === 1 ? "" : "s"} ago`,
      recommendation:
        "This account is disconnected. Record a new number manually to refresh it.",
    };
  if (days <= m.freshDays)
    return {
      state: "current",
      days,
      label:
        days === 0
          ? "Recorded today"
          : `Recorded ${days} day${days === 1 ? "" : "s"} ago`,
      recommendation: null,
    };
  return {
    state: "stale",
    days,
    label: `Stale: recorded ${days} days ago`,
    recommendation: `Update your ${m.label.toLowerCase()}. It is older than ${m.freshDays} days.`,
  };
}
