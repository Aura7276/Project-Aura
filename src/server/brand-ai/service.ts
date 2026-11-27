import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classify, type ServiceError } from "@/server/creator/service";

type Rpc = Pick<SupabaseClient, "rpc">;
export type BAResult<T> =
  { ok: true; value: T } | { ok: false; error: ServiceError; message: string };
const friendly = (code: string | undefined, m: string) =>
  /Choose a campaign/.test(m)
    ? "Choose a campaign for this task."
    : /Confirm before applying/.test(m)
      ? "Tick the box to confirm."
      : /Already handled/.test(m)
        ? "This draft was already applied or discarded."
        : /conversation is full/.test(m)
          ? "This conversation is full. Start a new one."
          : /7, 30 or 90/.test(m)
            ? "Plan drafts need 1 to 12 steps and a 7, 30 or 90-day horizon."
            : /at least 10 characters/.test(m)
              ? "Write at least 10 characters."
              : /no longer be edited/.test(m)
                ? "That campaign can no longer be edited."
                : code === "42501"
                  ? "You need to be an owner or admin of this Brand, signed in with your authenticator."
                  : code === "22023" || code === "23514"
                    ? "Some of that does not fit. Please check it."
                    : "We could not do that. Nothing was lost, so please try again.";
async function call<T>(
  c: Rpc,
  fn: string,
  args: Record<string, unknown>,
): Promise<BAResult<T>> {
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
export type Task =
  | "strategy"
  | "plan"
  | "brief"
  | "results"
  | "invitation"
  | "general"
  | "content";
export type Draft = {
  id: string;
  conversation_id: string | null;
  kind:
    | "plan_items"
    | "brief"
    | "invitation_message"
    | "strategy_note"
    | "content_ideas";
  target: { campaign_id?: string };
  content: {
    text?: string;
    horizon?: number;
    items?: { title: string; detail?: string }[];
    assumptions?: string[];
    gaps?: string[];
  };
  source: "ai" | "manual";
  status: "draft" | "applied" | "discarded";
  created_at: string;
  applied_at: string | null;
};
export type Turn = {
  id: number;
  role: "user" | "assistant";
  body: string;
  status: "ok" | "offline" | "error";
  context: {
    sources?: string[];
    assumptions?: string[];
    gaps?: string[];
  } | null;
  at: string;
};
export type State = {
  conversations: {
    id: string;
    task: Task;
    title: string;
    campaign_id: string | null;
    updated_at: string;
    turns: number;
  }[];
  drafts: Draft[];
  memory: { enabled: boolean; preferences: string | null } | null;
  sources: string[];
  usage: { used: number; allowance: number };
  campaigns: { id: string; title: string; status: string }[];
  verified: boolean;
};
export type Conversation = {
  id: string;
  task: Task;
  title: string;
  campaign_id: string | null;
  created_at: string;
  turns: Turn[];
  drafts: Draft[];
};
export const brandAi = {
  state: (c: Rpc, ws: string) =>
    call<State>(c, "aura_brand_ai_state", { p_workspace: ws }),
  context: (c: Rpc, ws: string, task: Task, campaign: string | null) =>
    call<{
      task: Task;
      sources: string[];
      facts: Record<string, unknown>;
      labels: Record<string, string>;
    }>(c, "aura_brand_ai_context", {
      p_workspace: ws,
      p_task: task,
      p_campaign: campaign,
    }),
  start: (
    c: Rpc,
    ws: string,
    request: string,
    task: Task,
    title: string,
    campaign: string | null,
  ) =>
    call<{ id: string }>(c, "aura_brand_ai_start", {
      p_workspace: ws,
      p_request: request,
      p_task: task,
      p_title: title,
      p_campaign: campaign,
    }),
  conversation: (c: Rpc, ws: string, id: string) =>
    call<Conversation>(c, "aura_brand_ai_conversation", {
      p_workspace: ws,
      p_conv: id,
    }),
  reserve: (c: Rpc, ws: string) =>
    call<boolean>(c, "aura_brand_ai_reserve", { p_workspace: ws }),
  record: (
    c: Rpc,
    ws: string,
    conv: string,
    prompt: string,
    reply: string | null,
    status: "ok" | "offline" | "error",
    context: unknown,
  ) =>
    call<{ ok: boolean }>(c, "aura_brand_ai_record", {
      p_workspace: ws,
      p_conv: conv,
      p_prompt: prompt,
      p_reply: reply,
      p_status: status,
      p_context: context,
    }),
  saveDraft: (
    c: Rpc,
    ws: string,
    conv: string | null,
    kind: Draft["kind"],
    target: Record<string, unknown>,
    content: Record<string, unknown>,
    source: "ai" | "manual",
  ) =>
    call<{ id: string }>(c, "aura_brand_ai_save_draft", {
      p_workspace: ws,
      p_conv: conv,
      p_kind: kind,
      p_target: target,
      p_content: content,
      p_source: source,
    }),
  apply: (c: Rpc, ws: string, id: string, confirm: boolean) =>
    call<{
      id: string;
      kind: Draft["kind"];
      applied_steps: number;
      campaign_id: string | null;
      text: string | null;
    }>(c, "aura_brand_ai_apply", {
      p_workspace: ws,
      p_draft: id,
      p_confirm: confirm,
    }),
  discard: (c: Rpc, ws: string, id: string) =>
    call<{ discarded: boolean }>(c, "aura_brand_ai_discard", {
      p_workspace: ws,
      p_draft: id,
    }),
  settings: (
    c: Rpc,
    ws: string,
    memory: boolean | null,
    preferences: string | null,
    remove: boolean,
    sources: string[] | null,
  ) =>
    call<Record<string, unknown>>(c, "aura_brand_ai_settings", {
      p_workspace: ws,
      p_memory: memory,
      p_preferences: preferences,
      p_delete: remove,
      p_sources: sources,
    }),
  remove: (c: Rpc, ws: string, id: string) =>
    call<{ deleted: boolean }>(c, "aura_brand_ai_delete_conversation", {
      p_workspace: ws,
      p_conv: id,
    }),
};
