import "server-only";
import { cache } from "react";
import { unavailableCommercial } from "@/features/creator-studio/commercial";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  creatorContext,
  repository as creator,
  classify,
  type Result,
} from "@/server/creator/service";
import {
  generateDailyActions,
  toPayload,
} from "@/features/creator-studio/daily-actions";
import type {
  Prefs,
  DailyAction,
  Idea,
  Milestones,
  Observation,
  SearchHit,
  Weekly,
  ActionStatus,
} from "@/features/creator-studio/types";

type Rpc = Pick<SupabaseClient, "rpc">;
async function call<T>(
  c: Rpc,
  fn: string,
  args: Record<string, unknown>,
): Promise<Result<T>> {
  const { data, error } = await c.rpc(fn, args);
  if (error || data === null || data === undefined)
    return { ok: false, error: classify(error) };
  return { ok: true, value: data as T };
}
export const studio = {
  context: (c: Rpc, ws: string) =>
    call<Prefs>(c, "aura_studio_context", { p_workspace: ws }),
  setPrefs: (
    c: Rpc,
    ws: string,
    v: {
      hidden: string[];
      gamification: boolean;
      digest: boolean;
      timezone: string;
    },
  ) =>
    call<Prefs>(c, "aura_studio_set_prefs", {
      p_workspace: ws,
      p_hidden: v.hidden,
      p_gamification: v.gamification,
      p_digest: v.digest,
      p_timezone: v.timezone,
    }),
  walkthrough: (c: Rpc, ws: string, status: string) =>
    call<Prefs>(c, "aura_studio_walkthrough", {
      p_workspace: ws,
      p_status: status,
    }),
  ensureActions: (c: Rpc, ws: string, actions: unknown) =>
    call<DailyAction[]>(c, "aura_studio_ensure_actions", {
      p_workspace: ws,
      p_actions: actions,
    }),
  actions: (c: Rpc, ws: string, days = 14) =>
    call<DailyAction[]>(c, "aura_studio_actions", {
      p_workspace: ws,
      p_days: days,
    }),
  setAction: (c: Rpc, ws: string, id: string, status: ActionStatus) =>
    call<DailyAction[]>(c, "aura_studio_set_action", {
      p_workspace: ws,
      p_action: id,
      p_status: status,
    }),
  record: (
    c: Rpc,
    ws: string,
    v: {
      request: string;
      category: string;
      metric: string;
      value: number;
      observed_on: string;
      note: string | null;
    },
  ) =>
    call<Observation>(c, "aura_studio_record_observation", {
      p_workspace: ws,
      p_request: v.request,
      p_category: v.category,
      p_metric: v.metric,
      p_value: v.value,
      p_observed_on: v.observed_on,
      p_note: v.note,
    }),
  observations: (c: Rpc, ws: string) =>
    call<Observation[]>(c, "aura_studio_observations", { p_workspace: ws }),
  capture: (
    c: Rpc,
    ws: string,
    v: { request: string; title: string; note: string | null },
  ) =>
    call<Idea>(c, "aura_studio_capture_idea", {
      p_workspace: ws,
      p_request: v.request,
      p_title: v.title,
      p_note: v.note,
    }),
  ideas: (c: Rpc, ws: string, limit = 30) =>
    call<{ total: number; items: Idea[] }>(c, "aura_studio_ideas", {
      p_workspace: ws,
      p_limit: limit,
    }),
  milestones: (c: Rpc, ws: string) =>
    call<Milestones>(c, "aura_studio_milestones", { p_workspace: ws }),
  weekly: (c: Rpc, ws: string) =>
    call<Weekly>(c, "aura_studio_weekly", { p_workspace: ws }),
  search: (c: Rpc, ws: string, q: string) =>
    call<SearchHit[]>(c, "aura_studio_search", { p_workspace: ws, p_query: q }),
  events: (c: Rpc, ws: string) =>
    call<{ event: string; at: string }[]>(c, "aura_studio_events", {
      p_workspace: ws,
    }),
};
const must = <T>(r: Result<T>, what: string): T => {
  if (r.ok) return r.value;
  if (r.error === "incomplete") redirect("/onboarding/creator"); // M03 continuation
  if (r.error === "denied") redirect("/workspaces");
  throw new Error(`Unable to load ${what}`); // generic: never echoes database detail
};
/**
 * Authenticates (M02), resolves the caller's own Creator workspace server-side, requires completed M03 activation
 * (otherwise redirects to the real onboarding continuation) and loads preferences. Memoized per request only.
 */
export const studioContext = cache(async () => {
  const ctx = await creatorContext();
  const state = must(
    await creator.state(ctx.client, ctx.workspaceId),
    "profile",
  );
  if (!state.profile?.activated_at) redirect("/onboarding/creator");
  const prefs = must(
    await studio.context(ctx.client, ctx.workspaceId),
    "preferences",
  );
  return { ...ctx, state, prefs };
});
export type StudioContext = Awaited<ReturnType<typeof studioContext>>;
const isoWeekday = (date: string) => {
  const d = new Date(date + "T00:00:00Z").getUTCDay();
  return d === 0 ? 7 : d;
};
const dayDiff = (a: string, b: string) =>
  Math.floor(
    (Date.parse(b + "T00:00:00Z") - Date.parse(a.slice(0, 10) + "T00:00:00Z")) /
      86_400_000,
  );
/** Everything the dashboard needs. Today's actions are generated once per local day by the database; re-opening never regenerates. */
export async function loadStudio(ctx: StudioContext) {
  const { client: c, workspaceId: ws, state, prefs } = ctx;
  const [obsR, ideasR, historyR] = await Promise.all([
    studio.observations(c, ws),
    studio.ideas(c, ws, 5),
    studio.actions(c, ws, 14),
  ]);
  const observations = must(obsR, "observations"),
    ideas = must(ideasR, "ideas"),
    history = must(historyR, "actions");
  const recent = new Set(
    history
      .filter(
        (a) =>
          a.status === "completed" && dayDiff(a.local_date, prefs.today) <= 3,
      )
      .map((a) => a.rule_key),
  );
  const weeklyFirst = must(await studio.weekly(c, ws), "weekly review");
  const generated = generateDailyActions({
    state,
    ideasTotal: ideas.total,
    lastIdeaDaysAgo: ideas.items[0]
      ? dayDiff(ideas.items[0].created_at, prefs.today)
      : null,
    observations,
    today: prefs.today,
    isoWeekday: isoWeekday(prefs.today),
    recentCompleted: recent,
    hasClosedReview: weeklyFirst.reviews.length > 0,
  });
  const today = must(
    await studio.ensureActions(c, ws, toPayload(generated)),
    "daily actions",
  );
  const [milestonesR, weeklyR] = await Promise.all([
    studio.milestones(c, ws),
    studio.weekly(c, ws),
  ]);
  const milestones = must(milestonesR, "milestones"),
    weekly = must(weeklyR, "weekly review");
  return {
    observations,
    ideas,
    today,
    history: history.filter((a) => a.local_date !== prefs.today),
    milestones,
    weekly,
  };
}

export const studioData = cache(async (ctx: StudioContext) => {
  const l = await loadStudio(ctx);
  const commercial = await unavailableCommercial.summary(ctx.workspaceId);
  return {
    state: ctx.state,
    prefs: ctx.prefs,
    today: l.today,
    history: l.history,
    observations: l.observations,
    ideas: l.ideas,
    milestones: l.milestones,
    weekly: l.weekly,
    commercial,
    live: true as const,
  };
});
