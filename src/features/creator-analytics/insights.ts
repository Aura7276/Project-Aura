import { freshness } from "@/features/creator-social/freshness";
import { metricLabel } from "@/features/creator-social/metrics";
import { platformLabel } from "@/features/creator-social/catalogue";
import { analyzePattern } from "./patterns";
import { timingAnalysis, timeBand } from "./timing";
import { daysBetween } from "./periods";
import { toPoints, netGrowth, comparePeriods } from "./growth";
import type { Period } from "./periods";
import type { AccountObs, AccountRef, ContentItem } from "./types";
// Rule-based diagnostics and insights. These are DETERMINISTIC RULES, labelled as such. They are not AI output and carry no confidence percentages.
// "priority" ranks which finding deserves attention first. It is not a score of the Creator, and nothing here rolls up into one.
export type Category = "growth_opportunity" | "data_quality" | "goal_progress" | "content_pattern" | "recommended_experiment" | "observation_update" | "measurement_inconsistency";
export type InsightInput = {
  fingerprint: string; category: Category; rule_key: string; rule_version: number; priority: number; title: string; explanation: string;
  evidence: Record<string, unknown>; limitations: string[]; action: string; link: string; data_hash: string;
};
export const ruleVersion = 1;
export const hash = (v: unknown) => { const s = JSON.stringify(v); let h1 = 0xdeadbeef ^ s.length, h2 = 0x41c6ce57 ^ s.length; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16); };
export type Inputs = { today: string; period: Period; previous: Period; accounts: AccountRef[]; observations: AccountObs[]; content: ContentItem[]; hasActiveExperiment: boolean };
export const allRules = ["rule.stale_account", "rule.no_observations", "rule.growth_change", "rule.content_pattern.format", "rule.content_pattern.topic", "rule.timing", "rule.classification", "rule.consistency", "rule.measurement_gap"] as const;
const make = (rule: string, subject: string, category: Category, priority: number, title: string, explanation: string, evidence: Record<string, unknown>, limitations: string[], action: string, link: string): InsightInput =>
  ({ fingerprint: `${rule}:${subject}`, category, rule_key: rule, rule_version: ruleVersion, priority, title, explanation, evidence, limitations, action, link, data_hash: hash(evidence) });
export function generateInsights(i: Inputs): InsightInput[] {
  const out: InsightInput[] = [];
  const tracked = i.accounts.filter((a) => a.lifecycle !== "removed");
  for (const a of tracked) {
    const label = `${platformLabel(a.platform)} @${a.handle}`;
    const f = toPoints(i.observations, a.id, "followers"); const last = f.at(-1);
    const fr = freshness("followers", a.platform, last?.date ?? null, i.today, { disconnected: a.lifecycle === "disconnected" });
    if (fr.state === "unknown") out.push(make("rule.no_observations", a.id, "data_quality", 80, `Record a first follower count for ${label}`, "Nothing is recorded yet, so growth cannot be shown. An empty history is not a count of zero.", { account: label, lastObserved: null }, ["Nothing is shown for this account until a number is recorded."], "Record the current follower count.", `/creator/socials/${a.id}/metrics`));
    else if (fr.state === "stale") out.push(make("rule.stale_account", a.id, "observation_update", 70, `Update ${label}`, `The latest follower count is ${fr.days} days old, which is older than the freshness window for this metric.`, { account: label, lastObserved: last!.date, daysOld: fr.days }, ["Older numbers may no longer describe the account."], "Record today's number.", `/creator/socials/${a.id}/metrics`));
    if (f.length >= 2) {
      const cur = netGrowth(f, i.period), prev = netGrowth(f, i.previous), cmp = comparePeriods(cur, prev);
      if (cur.status !== "unavailable" && cmp.status !== "blocked") out.push(make("rule.growth_change", a.id, "growth_opportunity", 55, `${label}: net audience change ${cur.net >= 0 ? "+" : ""}${cur.net}`, `Between ${cur.baseline.date} and ${cur.latest.date} the recorded audience count changed by ${cur.net}${cur.pct !== null ? ` (${cur.pct}%)` : ""}. The previous period changed by ${cmp.previousNet}.`, { account: label, baseline: cur.baseline, latest: cur.latest, previousNet: cmp.previousNet, notes: cmp.notes }, ["Net change only; gains and losses are not separated.", "Self-reported counts.", ...cmp.notes], "Look at which content you published in this period.", `/creator/analytics/accounts`));
    }
  }
  const byPlatform = new Map<string, ContentItem[]>();
  for (const c of i.content) byPlatform.set(c.platform, [...(byPlatform.get(c.platform) ?? []), c]);
  for (const [platform, items] of byPlatform) {
    for (const metric of ["views", "likes"]) {
      const p = analyzePattern(items, "format", metric);
      if (p.status === "ok") { out.push(make("rule.content_pattern.format", `${platform}:${metric}`, "content_pattern", 50, `${platformLabel(platform)}: ${p.leader!.value} content has a higher median ${metricLabel(metric).toLowerCase()} than ${p.leader!.over}`, `On ${p.basis}, in ${p.groups.map((g) => `${g.value} (n=${g.n}, median ${g.median})`).join(" and ")}. This is an exploratory pattern.`, { platform, metric, groups: p.groups, basis: p.basis }, p.limitations, "Test it with a short experiment before changing your plan.", "/creator/analytics/content")); break; }
    }
    const tp = analyzePattern(items, "topic", "views");
    if (tp.status === "ok") out.push(make("rule.content_pattern.topic", platform, "content_pattern", 45, `${platformLabel(platform)}: topic differences in views`, `On ${tp.basis}: ${tp.groups.map((g) => `${g.value} (n=${g.n}, median ${g.median})`).join(", ")}.`, { platform, groups: tp.groups }, tp.limitations, "Consider an experiment on the leading topic.", "/creator/analytics/content"));
    const t = timingAnalysis(items, "views");
    if (t.suggestion) out.push(make("rule.timing", platform, "content_pattern", 48, `${platformLabel(platform)}: a publishing window worth testing`, t.suggestion.text, { platform, groups: t.pattern.status === "ok" ? t.pattern.groups : [], confidence: t.confidence }, t.limitations, "Run a two-window publishing experiment.", "/creator/experiments"));
    else if (items.filter(timeBand).length < items.length && items.length >= 6) out.push(make("rule.timing", platform + ":missing", "recommended_experiment", 35, `${platformLabel(platform)}: publishing times are not recorded`, "Without publication times no timing pattern can be assessed. This is not evidence that timing does not matter.", { platform, timed: items.filter(timeBand).length, total: items.length }, t.limitations, t.experiment ?? "", "/creator/analytics/content"));
  }
  const total = i.content.length;
  const tagged = i.content.filter((c) => c.tags.some((t) => t.status === "confirmed")).length;
  if (total >= 6 && tagged / total < 0.5) out.push(make("rule.classification", "all", "data_quality", 40, "Most content is not classified", `${tagged} of ${total} content items have a tag. Patterns can only be assessed for content that is classified.`, { tagged, total }, ["Tags are optional. Tagging is only needed for pattern analysis."], "Add a topic or hook tag to your recent content.", "/creator/analytics/content"));
  const recent = i.content.filter((c) => c.published_on && c.published_on >= i.period.start && c.published_on <= i.period.end);
  if (total >= 4) {
    if (recent.length === 0) out.push(make("rule.consistency", "none", "growth_opportunity", 42, "No content dates in this period", `No content you recorded was published between ${i.period.start} and ${i.period.end}. This only reflects content you have recorded in AURA.`, { period: i.period, recorded: total }, ["Content published but not recorded here is invisible to this check."], "Record recent content, or plan a consistency experiment.", "/creator/experiments"));
  }
  const inconsistent = i.observations.filter((o) => o.metric === "followers" && o.value === 0).length;
  if (inconsistent > 0 && i.observations.some((o) => o.metric === "followers" && o.value > 0)) out.push(make("rule.measurement_gap", "zero", "measurement_inconsistency", 60, "A follower count of zero was recorded after non-zero counts", "Check whether zero is correct or the number was unknown at the time. Zero is only a real answer when the account has no followers.", { zeroCount: inconsistent }, ["This is a data check, not a conclusion about the account."], "Review the history and correct any mistaken entry.", "/creator/analytics/accounts"));
  return out.sort((a, b) => b.priority - a.priority);
}
export type Diagnostic = { id: string; category: string; finding: string; evidence: unknown; period: Period; sample: number | null; definition: string; limitations: string[]; action: string; href: string; ruleKey: string; source: "rule" };
export const diagnosticsFrom = (list: InsightInput[], period: Period): Diagnostic[] =>
  list.map((x) => ({ id: x.fingerprint, category: x.category, finding: x.title, evidence: x.evidence, period, sample: typeof (x.evidence as { total?: number }).total === "number" ? (x.evidence as { total: number }).total : null, definition: x.explanation, limitations: x.limitations, action: x.action, href: x.link, ruleKey: x.rule_key, source: "rule" as const }));
export const daysSince = daysBetween;
