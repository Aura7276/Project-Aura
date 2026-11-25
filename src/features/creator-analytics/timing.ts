import type { ContentItem } from "./types";
import { analyzePattern, type PatternResult } from "./patterns";
// Publishing-time intelligence. Uses real publication timestamps in the Creator's zone. It describes when published content performed, and never
// claims to know when the audience is active (that needs audience-activity data, which publication times cannot supply).
export const timeCategories = [
  "morning",
  "afternoon",
  "evening",
  "night",
] as const;
export type TimeCategory = (typeof timeCategories)[number];
export function categoryOf(
  publishedAt: string,
  tz: string,
): { category: TimeCategory; weekend: boolean; hour: number } | null {
  try {
    const f = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    }).formatToParts(new Date(publishedAt));
    const hour = Number(f.find((p) => p.type === "hour")?.value);
    const wd = f.find((p) => p.type === "weekday")?.value ?? "";
    if (Number.isNaN(hour)) return null;
    const category: TimeCategory =
      hour >= 5 && hour < 12
        ? "morning"
        : hour >= 12 && hour < 17
          ? "afternoon"
          : hour >= 17 && hour < 22
            ? "evening"
            : "night";
    return { category, weekend: wd === "Sat" || wd === "Sun", hour };
  } catch {
    return null;
  }
}
export const timeBand = (i: ContentItem) =>
  i.published_at && i.tz
    ? (categoryOf(i.published_at, i.tz)?.category ?? null)
    : null;
export type TimingResult = {
  timed: number;
  total: number;
  pattern: PatternResult;
  confidence: "none" | "low" | "moderate";
  suggestion: { window: TimeCategory; text: string } | null;
  experiment: string | null;
  limitations: string[];
};
export function timingAnalysis(
  items: ContentItem[],
  metric: string,
): TimingResult {
  const timed = items.filter((i) => timeBand(i) !== null);
  const pattern = analyzePattern(items, "time_category", metric, timeBand);
  const limitations = [
    "Based on when you published, not on when your audience was online.",
    "Content age, topic and format also differ between posts.",
    "A suggestion is something to test, not a best time.",
  ];
  const experiment =
    "Publish comparable content in two different time windows over at least four weeks, keeping topic and format the same, and record the same metric for each.";
  if (pattern.status !== "ok")
    return {
      timed: timed.length,
      total: items.length,
      pattern,
      confidence: "none",
      suggestion: null,
      experiment,
      limitations,
    };
  const weeks = new Set(
    timed
      .map((i) => i.published_at!.slice(0, 10))
      .map((d) => Math.floor(Date.parse(d) / (7 * 86_400_000))),
  ).size;
  const confidence =
    pattern.groups.every((g) => g.n >= 8) && weeks >= 3 ? "moderate" : "low";
  const lead = pattern.leader!;
  return {
    timed: timed.length,
    total: items.length,
    pattern,
    confidence,
    suggestion: {
      window: lead.value as TimeCategory,
      text: `Content published in the ${lead.value} had a higher median ${pattern.metric.replace(/_/g, " ")} than ${lead.over} content in your records. Treat ${lead.value} as a window to test.`,
    },
    experiment,
    limitations,
  };
}
