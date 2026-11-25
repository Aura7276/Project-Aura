import { daysBetween } from "./periods";
import type { Point } from "./growth";
// Scenario ranges, not predictions. Needs enough real history; otherwise explains what is missing.
export const thresholds = {
  minObservations: 8,
  minSpanDays: 56,
  maxGapDays: 21,
};
export type Forecast =
  | { status: "insufficient"; reasons: string[]; need: string }
  | {
      status: "ok";
      horizonDays: number;
      basis: string;
      scenarios: {
        name: "lower" | "middle" | "upper";
        perDay: number;
        value: number;
      }[];
      last: Point;
      limitations: string[];
    };
const q = (s: number[], p: number) => {
  const a = [...s].sort((x, y) => x - y);
  const i = (a.length - 1) * p;
  const lo = Math.floor(i),
    hi = Math.ceil(i);
  return a[lo] + (a[hi] - a[lo]) * (i - lo);
};
export function scenarioForecast(
  points: Point[],
  horizonDays: number,
): Forecast {
  const reasons: string[] = [];
  if (points.length < thresholds.minObservations)
    reasons.push(
      `${points.length} observation${points.length === 1 ? "" : "s"} recorded; at least ${thresholds.minObservations} are needed.`,
    );
  const spanDays = points.length
    ? daysBetween(points[0].date, points.at(-1)!.date)
    : 0;
  if (spanDays < thresholds.minSpanDays)
    reasons.push(
      `The history spans ${spanDays} days; at least ${thresholds.minSpanDays} are needed.`,
    );
  const gaps = points
    .slice(1)
    .map((p, i) => daysBetween(points[i].date, p.date));
  if (gaps.some((g) => g > thresholds.maxGapDays))
    reasons.push(
      `There is a gap of ${Math.max(...gaps)} days between observations; gaps over ${thresholds.maxGapDays} days make a range unreliable.`,
    );
  if (reasons.length)
    return {
      status: "insufficient",
      reasons,
      need: `Record the number about every week until you have ${thresholds.minObservations} observations over ${thresholds.minSpanDays} days.`,
    };
  const rates = points
    .slice(1)
    .map(
      (p, i) =>
        (p.value - points[i].value) /
        Math.max(1, daysBetween(points[i].date, p.date)),
    );
  const last = points.at(-1)!;
  const s = (name: "lower" | "middle" | "upper", per: number) => ({
    name,
    perDay: per,
    value: Math.round(last.value + per * horizonDays),
  });
  return {
    status: "ok",
    horizonDays,
    last,
    basis: `Each scenario applies the 25th percentile, the median and the 75th percentile of your own observed per-day change between ${points.length} recorded observations.`,
    scenarios: [
      s("lower", q(rates, 0.25)),
      s("middle", q(rates, 0.5)),
      s("upper", q(rates, 0.75)),
    ],
    limitations: [
      "This is a scenario range from your own past changes, not a prediction.",
      "It assumes future change resembles the past. Content, platform changes and seasons can break that.",
      "It is not a promise of any result.",
    ],
  };
}
