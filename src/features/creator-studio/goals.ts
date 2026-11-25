import {
  goalCategories,
  label,
  metricLabels,
} from "@/features/creator-onboarding/taxonomy";
import type { Goal } from "@/features/creator-onboarding/types";
import type { Observation } from "./types";

export const staleAfterDays = 14;
export type Progress =
  | { kind: "from_baseline"; fraction: number; percent: number }
  | { kind: "of_target"; latest: number; target: number }
  | { kind: "none"; reason: string };
export type GoalView = {
  key: string;
  category: string;
  categoryLabel: string;
  metric: string | null;
  metricLabel: string | null;
  target: number | null;
  baseline: { value: number; kind: "self_reported" | "observed" } | null;
  latest: Observation | null;
  observationCount: number;
  timeframeDays: number | null;
  status: "no_measure" | "no_observation" | "tracking";
  freshness: "none" | "fresh" | "stale";
  progress: Progress;
  source: "Self-reported" | null;
  nextAction: string;
};
const days = (from: string, to: string) =>
  Math.floor(
    (Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) /
      86_400_000,
  );
const byLatest = (a: Observation, b: Observation) =>
  b.observed_on.localeCompare(a.observed_on) ||
  b.created_at.localeCompare(a.created_at);
export const goalKey = (category: string, metric: string | null) =>
  `${category}:${metric ?? ""}`;
/** Never invents a baseline and never substitutes a percentage when a goal cannot be measured. A recorded zero is a value; no observation is unknown. */
export function evaluateGoal(
  goal: Goal,
  all: Observation[],
  today: string,
): GoalView {
  const obs = goal.metric
    ? all
        .filter((o) => o.category === goal.category && o.metric === goal.metric)
        .sort(byLatest)
    : [];
  const latest = obs[0] ?? null;
  const baseline =
    goal.baseline_value !== null && goal.baseline_kind !== "unknown"
      ? {
          value: goal.baseline_value,
          kind: goal.baseline_kind as "self_reported" | "observed",
        }
      : null;
  const view = (p: Partial<GoalView>): GoalView => ({
    key: goalKey(goal.category, goal.metric),
    category: goal.category,
    categoryLabel: label(goalCategories, goal.category),
    metric: goal.metric,
    metricLabel: goal.metric
      ? (metricLabels[goal.metric] ?? goal.metric)
      : null,
    target: goal.target_value,
    baseline,
    latest,
    observationCount: obs.length,
    timeframeDays: goal.timeframe_days,
    status: "tracking",
    freshness: "none",
    progress: { kind: "none", reason: "" },
    source: latest ? "Self-reported" : null,
    nextAction: "",
    ...p,
  });
  if (!goal.metric)
    return view({
      status: "no_measure",
      progress: {
        kind: "none",
        reason: "No measurable target is set for this goal.",
      },
      nextAction: "Choose something to measure when you are ready.",
    });
  if (!latest)
    return view({
      status: "no_observation",
      progress: { kind: "none", reason: "Nothing has been recorded yet." },
      nextAction: "Record where you are today.",
    });
  const freshness =
    days(latest.observed_on, today) > staleAfterDays ? "stale" : "fresh";
  let progress: Progress;
  if (
    baseline &&
    goal.target_value !== null &&
    goal.target_value !== baseline.value
  ) {
    const fraction =
      (latest.value - baseline.value) / (goal.target_value - baseline.value);
    progress = {
      kind: "from_baseline",
      fraction,
      percent: Math.round(fraction * 100),
    };
  } else if (goal.target_value !== null)
    progress = {
      kind: "of_target",
      latest: latest.value,
      target: goal.target_value,
    };
  else
    progress = {
      kind: "none",
      reason: "No target is set, so there is nothing to measure against.",
    };
  return view({
    freshness,
    progress,
    nextAction:
      freshness === "stale"
        ? "Update your latest number."
        : "Keep going. Record again after your next milestone.",
  });
}
export const evaluateGoals = (
  goals: Goal[],
  obs: Observation[],
  today: string,
) => goals.map((g) => evaluateGoal(g, obs, today));
/** Evidence-based statements only: they describe recorded changes and never claim a cause. */
export function insights(views: GoalView[], obs: Observation[]): string[] {
  const out: string[] = [];
  for (const v of views) {
    if (!v.metric) continue;
    const series = obs
      .filter((o) => o.category === v.category && o.metric === v.metric)
      .sort(
        (a, b) =>
          a.observed_on.localeCompare(b.observed_on) ||
          a.created_at.localeCompare(b.created_at),
      );
    if (series.length >= 2) {
      const a = series[0],
        b = series[series.length - 1],
        d = b.value - a.value;
      out.push(
        `${v.metricLabel}: ${a.value} on ${a.observed_on} to ${b.value} on ${b.observed_on} (${d >= 0 ? "+" : ""}${d}). This is your own recorded data and does not show what caused the change.`,
      );
    } else if (series.length === 1)
      out.push(
        `${v.metricLabel}: one observation so far. Record another to see a trend.`,
      );
  }
  return out;
}
export const chartable = (
  obs: Observation[],
  category: string,
  metric: string,
) =>
  obs
    .filter((o) => o.category === category && o.metric === metric)
    .sort(
      (a, b) =>
        a.observed_on.localeCompare(b.observed_on) ||
        a.created_at.localeCompare(b.created_at),
    );
