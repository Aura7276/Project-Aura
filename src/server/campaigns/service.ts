import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classify, type ServiceError } from "@/server/creator/service";
import type {
  OverviewItem,
  PlanState,
  Rollout,
} from "@/features/campaigns/rules";

type Rpc = Pick<SupabaseClient, "rpc">;
export type CResult<T> =
  { ok: true; value: T } | { ok: false; error: ServiceError; message: string };
const friendly = (code: string | undefined, m: string) =>
  /opens later/.test(m)
    ? "This campaign type opens later. You can keep it as a draft."
    : /Positions cannot be fewer/.test(m)
      ? m.replace(/^.*?(Positions)/, "$1") + "."
      : /owner must be/.test(m)
        ? "The owner must be a member of this workspace."
        : /milestone/.test(m)
          ? "Each milestone needs a label of 2 to 80 characters (at most 12)."
          : /Close the campaign/.test(m)
            ? "Close the campaign before archiving it."
            : code === "42501"
              ? "You need to be an owner or admin of this Brand, signed in with your authenticator."
              : code === "22023" || code === "23514"
                ? "Some of that does not fit. Please check it."
                : "We could not do that. Nothing was lost, so please try again.";
async function call<T>(
  c: Rpc,
  fn: string,
  args: Record<string, unknown>,
): Promise<CResult<T>> {
  const { data, error } = await c.rpc(fn, args);
  if (error || data === null || data === undefined) {
    const e = error as { code?: string; message?: string } | null;
    return {
      ok: false,
      error: classify(error),
      message: friendly(e?.code, e?.message ?? ""),
    };
  }
  return { ok: true, value: data as T };
}
export const campaigns = {
  overview: (c: Rpc, ws: string) =>
    call<{ rollout: Rollout; verified: boolean; campaigns: OverviewItem[] }>(
      c,
      "aura_campaign_overview",
      { p_workspace: ws },
    ),
  plan: (c: Rpc, ws: string, id: string) =>
    call<PlanState>(c, "aura_campaign_plan", {
      p_workspace: ws,
      p_campaign: id,
    }),
  savePlan: (c: Rpc, ws: string, id: string, f: Record<string, unknown>) =>
    call<PlanState>(c, "aura_campaign_save_plan", {
      p_workspace: ws,
      p_campaign: id,
      p_fields: f,
    }),
  duplicate: (c: Rpc, ws: string, id: string, request: string) =>
    call<{ id: string }>(c, "aura_campaign_duplicate", {
      p_workspace: ws,
      p_campaign: id,
      p_request: request,
    }),
  archive: (c: Rpc, ws: string, id: string, on: boolean) =>
    call<{ archived: boolean }>(c, "aura_campaign_archive", {
      p_workspace: ws,
      p_campaign: id,
      p_on: on,
    }),
  rollout: (c: Rpc) => call<Rollout>(c, "aura_campaign_rollout", {}),
  availability: (c: Rpc, ws: string, id: string) =>
    call<{
      positions: number | null;
      selected: number;
      remaining: number | null;
    }>(c, "aura_campaign_availability", { p_workspace: ws, p_campaign: id }),
};
