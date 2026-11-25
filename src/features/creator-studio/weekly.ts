import type { WeekSummary } from "./types";
/** Describes only what was recorded. No growth percentages, no causal claims, no invented lessons. */
export function describeWeek(s: WeekSummary): {
  lines: string[];
  sufficient: boolean;
  focus: string;
} {
  const lines: string[] = [];
  const a = s.actions;
  if (a.assigned || a.completed)
    lines.push(
      `Actions: ${a.completed} completed${a.skipped ? `, ${a.skipped} skipped` : ""}${a.deferred ? `, ${a.deferred} deferred` : ""} (${a.assigned} assigned that week).`,
    );
  if (s.observations)
    lines.push(
      `Progress: ${s.observations} observation${s.observations === 1 ? "" : "s"} recorded.`,
    );
  for (const g of s.goals_observed)
    if (g.count >= 2)
      lines.push(
        `${g.metric.replace(/_/g, " ")}: recorded ${g.first} then ${g.last} this week.`,
      );
  if (s.ideas) lines.push(`Ideas: ${s.ideas} captured.`);
  if (s.profile_updates)
    lines.push(
      `Profile: ${s.profile_updates} section${s.profile_updates === 1 ? "" : "s"} updated.`,
    );
  const focus = !s.evidence_sufficient
    ? "There was not enough recorded activity to draw any conclusions. Completing one action or recording one observation gives the next review something to show."
    : a.completed === 0
      ? "Pick one small action to complete this week."
      : s.observations === 0
        ? "Record where you stand on one goal so future reviews can show a trend."
        : "Keep recording after each milestone so trends stay current.";
  return { lines, sufficient: s.evidence_sufficient, focus };
}
export const weekLabel = (s: Pick<WeekSummary, "week_start" | "week_end">) =>
  `${s.week_start} to ${s.week_end}`;
