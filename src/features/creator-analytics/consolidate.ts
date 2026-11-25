import type { AccountObs, AccountRef } from "./types";
import { overlapLabelled, canSum, caveats } from "./semantics";
import { toPoints } from "./growth";
import { freshness } from "@/features/creator-social/freshness";
// Consolidated activity across authorized accounts. Aggregates exist only where the metric's semantics permit one, and they say what they are.
export type Contribution = { account: AccountRef; value: number | null; observedOn: string | null; state: "value" | "unknown" | "stale"; staleNote: string | null };
export type Consolidated =
  | { status: "per_account_only"; metric: string; reason: string; contributions: Contribution[] }
  | { status: "aggregate"; metric: string; label: string; total: number; contributions: Contribution[]; coverage: string; caveat: string; method: string };
export function consolidateLatest(obs: AccountObs[], accounts: AccountRef[], metric: string, today: string): Consolidated {
  const contributions: Contribution[] = accounts.map((a) => {
    const p = toPoints(obs, a.id, metric).at(-1);
    if (!p) return { account: a, value: null, observedOn: null, state: "unknown", staleNote: null };
    const f = freshness(metric, a.platform, p.date, today, { disconnected: a.lifecycle === "disconnected" });
    return { account: a, value: p.value, observedOn: p.date, state: f.state === "stale" ? "stale" : "value", staleNote: f.state === "stale" ? f.label : null };
  });
  if (!overlapLabelled(metric) && !canSum(metric)) return { status: "per_account_only", metric, contributions, reason: caveats[metric] ?? "This metric is not combined across accounts." };
  const known = contributions.filter((c) => c.value !== null);
  if (!known.length) return { status: "per_account_only", metric, contributions, reason: "Nothing has been recorded for this metric yet. Unknown is not zero." };
  const total = known.reduce((n, c) => n + (c.value as number), 0);
  const platforms = new Set(known.map((c) => c.account.platform));
  return {
    status: "aggregate", metric, contributions, total,
    label: overlapLabelled(metric) ? "Platform-account audience count (includes possible overlap, not unique people)" : "Total of the latest recorded values",
    caveat: overlapLabelled(metric) ? `${caveats[metric]} Counts across ${platforms.size} platform${platforms.size === 1 ? "" : "s"}; no de-duplication evidence exists.` : "Each account's latest recorded value, which may be from different dates.",
    coverage: `${known.length} of ${contributions.length} accounts have a recorded value${contributions.some((c) => c.state === "stale") ? "; some are stale" : ""}.`,
    method: "Sum of each account's latest recorded value. No averaging, no de-duplication.",
  };
}
/** Denominator-weighted rate: total numerator ÷ total denominator over accounts that have BOTH. Never an average of percentages. */
export function weightedRate(rows: { account: string; numerator: number | null; denominator: number | null }[]) {
  const ok = rows.filter((r) => r.numerator !== null && r.denominator !== null && (r.denominator as number) > 0);
  if (!ok.length) return { status: "unavailable" as const, reason: "No account has both a numerator and a denominator above zero." };
  const n = ok.reduce((s, r) => s + (r.numerator as number), 0), d = ok.reduce((s, r) => s + (r.denominator as number), 0);
  return { status: "ok" as const, percent: Math.round((n / d) * 10000) / 100, accounts: ok.length, of: rows.length, method: "Total interactions ÷ total denominator across the accounts that have both. Not an average of each account's percentage." };
}
