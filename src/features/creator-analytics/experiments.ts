// Growth Experiment Lab domain rules. Templates are starting points, not strategies. Comparisons are descriptive: no statistical test is run,
// no significance is claimed, and an experiment is never described as controlled.
export const statuses = [
  "draft",
  "planned",
  "active",
  "completed",
  "cancelled",
] as const;
export type ExpStatus = (typeof statuses)[number];
export const outcomes = [
  "observed_improvement",
  "no_clear_difference",
  "observed_decline",
  "inconclusive",
  "insufficient_evidence",
] as const;
export type Outcome = (typeof outcomes)[number];
export const outcomeLabels: Record<Outcome, string> = {
  observed_improvement: "Observed improvement",
  no_clear_difference: "No clear difference",
  observed_decline: "Observed decline",
  inconclusive: "Inconclusive",
  insufficient_evidence: "Insufficient evidence",
};
const next: Record<ExpStatus, ExpStatus[]> = {
  draft: ["planned", "active", "cancelled"],
  planned: ["active", "cancelled"],
  active: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};
export const canMove = (from: ExpStatus, to: ExpStatus) =>
  next[from].includes(to);
export const editable = (s: ExpStatus) => s === "draft" || s === "planned";
export type Template = {
  key: string;
  name: string;
  hypothesis: string;
  objective: string;
  metric: string;
  planned_change: string;
  measurement_method: string;
  success_criterion: string;
  confounders: string;
  evaluation_days: number;
};
export const templates: Template[] = [
  {
    key: "hook-question-vs-statement",
    name: "Question hooks against statement hooks",
    hypothesis:
      "Opening with a question may lead to higher views in the first 7 days than opening with a statement.",
    objective: "Learn which opening style suits my audience",
    metric: "views",
    planned_change:
      "Publish at least 3 posts that open with a question and 3 that open with a statement, on the same topic and format.",
    measurement_method: "Record 7-day views for every post.",
    success_criterion:
      "The median 7-day views of one style is clearly different from the other.",
    confounders: "Topic, posting time, trends and posting frequency.",
    evaluation_days: 28,
  },
  {
    key: "duration",
    name: "Short against slightly longer videos",
    hypothesis:
      "Videos under 30 seconds may differ in 7-day views from videos of 45 to 60 seconds.",
    objective: "Find a duration worth keeping",
    metric: "views",
    planned_change: "Publish matched topics at two durations.",
    measurement_method: "Record 7-day views for each post.",
    success_criterion:
      "A consistent difference across at least 3 posts per duration.",
    confounders: "Topic, hook and posting time.",
    evaluation_days: 28,
  },
  {
    key: "tutorial-vs-lifestyle",
    name: "Tutorial against lifestyle content",
    hypothesis: "Tutorial posts may collect more saves than lifestyle posts.",
    objective: "Understand which format is saved more",
    metric: "saves",
    planned_change: "Alternate tutorial and lifestyle posts for four weeks.",
    measurement_method: "Record 7-day saves.",
    success_criterion: "A consistent difference in median saves.",
    confounders: "Topic interest and posting time.",
    evaluation_days: 28,
  },
  {
    key: "publishing-window",
    name: "Two publishing windows",
    hypothesis:
      "Posting in the evening may differ in 7-day views from posting in the morning.",
    objective: "Test a publishing window instead of assuming one",
    metric: "views",
    planned_change: "Post comparable content at two different times of day.",
    measurement_method: "Record 7-day views and the publication time.",
    success_criterion: "A consistent difference over at least 4 weeks.",
    confounders: "Content differences, weekday and trends.",
    evaluation_days: 28,
  },
  {
    key: "consistency",
    name: "A steadier posting rhythm",
    hypothesis:
      "Publishing at a steady weekly rhythm may be followed by steadier audience growth.",
    objective: "Check whether consistency is followed by growth",
    metric: "followers",
    planned_change: "Publish on a fixed schedule for four weeks.",
    measurement_method: "Record followers weekly.",
    success_criterion:
      "Net follower change is higher than in the previous four weeks.",
    confounders: "Content quality, seasons and promotion.",
    evaluation_days: 28,
  },
];
export type SnapshotObs = {
  ref: string;
  value: number;
  observed_on: string;
  window_days: number | null;
  window_kind?: string | null;
  source: string;
  corrected?: boolean;
};
export type Measurement =
  | { status: "no_baseline"; reason: string; observed: number }
  | { status: "no_observations"; baseline: number; reason: string }
  | {
      status: "ok";
      baseline: number;
      baselineN: number;
      observed: number;
      observedN: number;
      absolute: number;
      relative: number | null;
      direction: "higher" | "lower" | "similar";
      coverage: string;
      limitations: string[];
    };
const med = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
/** Uses the FROZEN baseline snapshots and the snapshots taken when each observation was linked. Corrections after the fact are reported, never silently applied. */
export function measure(
  baseline: SnapshotObs[],
  linked: SnapshotObs[],
  evaluationDays: number,
  opts: { confounders?: string | null; reassessment?: boolean } = {},
): Measurement {
  if (!baseline.length)
    return {
      status: "no_baseline",
      reason:
        "No baseline was recorded for this experiment, so no difference can be calculated.",
      observed: linked.length,
    };
  const b = med(baseline.map((x) => x.value));
  if (!linked.length)
    return {
      status: "no_observations",
      baseline: b,
      reason: "No observations have been added yet.",
    };
  const o = med(linked.map((x) => x.value));
  const absolute = o - b;
  const relative = b > 0 ? Math.round((absolute / b) * 1000) / 10 : null;
  const direction =
    relative === null
      ? absolute === 0
        ? "similar"
        : absolute > 0
          ? "higher"
          : "lower"
      : Math.abs(relative) < 5
        ? "similar"
        : relative > 0
          ? "higher"
          : "lower";
  const limitations = [
    "Descriptive comparison of medians. No statistical test was run and no significance is claimed.",
    "This is not a controlled experiment: anything that changed besides your planned change could explain the difference.",
  ];
  if (linked.length < 3)
    limitations.push(
      `Only ${linked.length} observation${linked.length === 1 ? "" : "s"}; a few numbers move around by chance.`,
    );
  if (baseline.length < 2)
    limitations.push("The baseline is a single observation.");
  if (opts.confounders)
    limitations.push(`You noted possible confounders: ${opts.confounders}`);
  if (opts.reassessment)
    limitations.push(
      "An observation was corrected after it was added. The values used here are the ones you accepted; reassess if the correction matters.",
    );
  if (relative === null && b === 0)
    limitations.push(
      "A relative change is not calculated because the baseline is zero.",
    );
  return {
    status: "ok",
    baseline: b,
    baselineN: baseline.length,
    observed: o,
    observedN: linked.length,
    absolute,
    relative,
    direction,
    coverage: `${linked.length} observation${linked.length === 1 ? "" : "s"} against a ${evaluationDays}-day evaluation period`,
    limitations,
  };
}
/** A neutral suggestion only. The Creator chooses the outcome. */
export function outcomeHint(m: Measurement): Outcome | null {
  if (m.status !== "ok") return "insufficient_evidence";
  if (m.observedN < 3) return "insufficient_evidence";
  return m.direction === "similar"
    ? "no_clear_difference"
    : m.direction === "higher"
      ? "observed_improvement"
      : "observed_decline";
}
