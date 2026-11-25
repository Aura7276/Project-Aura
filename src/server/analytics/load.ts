import "server-only";
import { notFound } from "next/navigation";
import { studioContext } from "@/server/studio/service";
import { analytics, type AResult } from "./service";
import {
  resolveRange,
  addDays,
  isDate,
  type RangeKey,
} from "@/features/creator-analytics/periods";
import {
  generateInsights,
  allRules,
} from "@/features/creator-analytics/insights";

export type Params = Record<string, string | string[] | undefined>;
export const one = (p: Params, k: string) =>
  typeof p[k] === "string" ? (p[k] as string) : undefined;
const must = <T>(r: AResult<T>): T => {
  if (!r.ok) throw new Error("analytics:" + r.error);
  return r.value;
};
export const rangeKeys: RangeKey[] = ["7d", "30d", "90d", "custom"];
export async function loadBase(sp: Params) {
  const ctx = await studioContext();
  const key = (rangeKeys as string[]).includes(one(sp, "range") ?? "")
    ? (one(sp, "range") as RangeKey)
    : "30d";
  let range = resolveRange(key, ctx.prefs.today, {
    start: one(sp, "start"),
    end: one(sp, "end"),
  });
  let rangeError: string | null = null;
  if (!range.ok) {
    rangeError = range.reason;
    range = resolveRange("30d", ctx.prefs.today);
  }
  if (!range.ok) notFound();
  const series = must(
    await analytics.series(
      ctx.client,
      ctx.workspaceId,
      range.previous.start,
      range.current.end,
    ),
  );
  const accountParam = one(sp, "account");
  const platform = one(sp, "platform");
  const accounts = series.accounts.filter(
    (a) =>
      (!accountParam || accountParam === "all" || a.id === accountParam) &&
      (!platform || a.platform === platform),
  );
  return {
    ctx,
    range,
    rangeError,
    series,
    accounts,
    observations: series.observations.filter((o) =>
      accounts.some((a) => a.id === o.account_id),
    ),
    allAccounts: series.accounts,
    accountParam: accountParam ?? "all",
    platform: platform ?? "",
    today: ctx.prefs.today,
  };
}
export type Base = Awaited<ReturnType<typeof loadBase>>;
/** Rule-based insights are regenerated from current data and synced idempotently (unchanged evidence creates nothing). */
export async function syncInsights(b: Base) {
  const content = must(
    await analytics.content(b.ctx.client, b.ctx.workspaceId, null),
  ).content;
  const list = generateInsights({
    today: b.today,
    period: b.range.current,
    previous: b.range.previous,
    accounts: b.allAccounts,
    observations: b.series.observations,
    content,
    hasActiveExperiment: false,
  });
  await analytics.syncInsights(b.ctx.client, b.ctx.workspaceId, list, allRules);
  return { content, generated: list };
}
export { addDays, isDate, must };
