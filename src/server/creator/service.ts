import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { eligible } from "@/server/auth/session";
import type { CreatorState, StepId } from "@/features/creator-onboarding/types";

export type ServiceError =
  "conflict" | "denied" | "incomplete" | "invalid" | "failed";
export type Result<T> =
  { ok: true; value: T } | { ok: false; error: ServiceError };
type Rpc = Pick<SupabaseClient, "rpc">;

/** Maps database errors to safe categories. Messages and payloads are never surfaced or logged. */
export function classify(error: { code?: string } | null): ServiceError {
  switch (error?.code) {
    case "40001":
      return "conflict";
    case "42501":
      return "denied";
    case "55000":
      return "incomplete";
    case "22023":
    case "22P02":
    case "23514":
    case "23505":
    case "23503":
    case "22003":
    case "22007":
      return "invalid";
    default:
      return "failed";
  }
}
async function call<T>(
  client: Rpc,
  fn: string,
  args: Record<string, unknown>,
): Promise<Result<T>> {
  const { data, error } = await client.rpc(fn, args);
  if (error || data === null || data === undefined)
    return { ok: false, error: classify(error) };
  return { ok: true, value: data as T };
}
export const repository = {
  begin: (c: Rpc, ws: string) =>
    call<CreatorState>(c, "aura_creator_begin", { p_workspace: ws }),
  state: (c: Rpc, ws: string) =>
    call<CreatorState>(c, "aura_creator_state", { p_workspace: ws }),
  save: (
    c: Rpc,
    ws: string,
    section: StepId,
    payload: unknown,
    revision: number,
    next: string | null,
  ) =>
    call<CreatorState>(c, "aura_creator_save_section", {
      p_workspace: ws,
      p_section: section,
      p_payload: payload,
      p_revision: revision,
      p_next: next,
    }),
  skip: (
    c: Rpc,
    ws: string,
    step: StepId,
    revision: number,
    next: string | null,
  ) =>
    call<CreatorState>(c, "aura_creator_skip_step", {
      p_workspace: ws,
      p_step: step,
      p_revision: revision,
      p_next: next,
    }),
  activate: (c: Rpc, ws: string, request: string, plan: unknown) =>
    call<CreatorState>(c, "aura_creator_activate", {
      p_workspace: ws,
      p_request: request,
      p_plan: plan,
    }),
  setAction: async (
    c: Rpc,
    ws: string,
    action: string,
    done: boolean,
  ): Promise<Result<true>> => {
    const { error } = await c.rpc("aura_creator_set_action", {
      p_workspace: ws,
      p_action: action,
      p_done: done,
    });
    return error
      ? { ok: false, error: classify(error) }
      : { ok: true, value: true };
  },
};

/**
 * Resolves the caller's own Creator workspace from the authenticated session (M02). The workspace id is never
 * taken from the request, and every database function independently re-checks membership and ownership.
 */
export async function creatorContext() {
  const ctx = await eligible();
  const { data, error } = await ctx.client.rpc("aura_workspaces");
  if (error) throw new Error("Unable to load workspaces");
  const own = (
    data as { id: string; kind: string; role: string; status: string }[]
  ).find((w) => w.kind === "creator" && w.role === "owner");
  if (!own) redirect("/workspaces");
  return {
    client: ctx.client as Rpc,
    workspaceId: own.id,
    userId: ctx.user.id,
    user: ctx.user,
    status: own.status,
  };
}
export async function loadState() {
  const ctx = await creatorContext();
  const begun = await repository.begin(ctx.client, ctx.workspaceId);
  if (!begun.ok) {
    if (begun.error === "denied") redirect("/workspaces");
    throw new Error("Unable to load onboarding");
  }
  return { ...ctx, state: begun.value };
}
