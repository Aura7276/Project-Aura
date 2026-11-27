import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classify, type ServiceError } from "@/server/creator/service";

type Rpc = Pick<SupabaseClient, "rpc">;
export type SResult<T> =
  { ok: true; value: T } | { ok: false; error: ServiceError; message: string };
const friendly = (code: string | undefined, m: string) =>
  /filled or held/.test(m)
    ? "Every place is already taken or held. Release a hold or add positions first."
    : /already held/.test(m)
      ? "A place is already held for this Creator."
      : /cannot be offered/.test(m)
        ? "This application cannot be offered a place at this stage."
        : /no open offer/.test(m)
          ? "There is no open offer any more. It may have expired."
          : /no longer meet/.test(m)
            ? "You no longer meet the campaign's mandatory requirements, so the place cannot be accepted."
            : /verification required/.test(m)
              ? "This needs an approved business verification."
              : /2 to 4/.test(m)
                ? "Choose 2 to 4 candidates to compare."
                : /note or add a tag/.test(m)
                  ? "Write a note or add a tag."
                  : code === "42501"
                    ? "You do not have access to this."
                    : "We could not do that. Nothing was lost, so please try again.";
async function call<T>(
  c: Rpc,
  fn: string,
  args: Record<string, unknown>,
): Promise<SResult<T>> {
  const { data, error } = await c.rpc(fn, args);
  if (error || data === undefined) {
    const e = error as { code?: string; message?: string } | null;
    return {
      ok: false,
      error: classify(error),
      message: friendly(e?.code, e?.message ?? ""),
    };
  }
  return { ok: true, value: data as T };
}
export type Hold = {
  id: string;
  status: "held" | "accepted" | "declined" | "expired" | "released";
  expires_at: string;
  message: string | null;
};
export type InboxItem = {
  id: string;
  creator: string;
  status: string;
  submitted_at: string;
  version: number;
  eligible: boolean;
  account: {
    platform: string;
    handle: string;
    ownership: string;
    followers: { value: number; observed_on: string; source: string } | null;
  } | null;
  quote: { currency: string; amount: number } | null;
  portfolio_count: number;
  questions_open: number;
  hold: { id: string; expires_at: string } | null;
  tags: string[];
  notes: number;
};
export type Inbox = {
  campaign: {
    id: string;
    title: string;
    status: string;
    category: string;
    money: {
      type: string;
      currency: string;
      min?: number;
      max?: number;
    } | null;
    capacity: number | null;
    taken: number;
    hold_hours: number;
  };
  applications: InboxItem[];
};
export type Check = {
  key: string;
  label: string;
  status: "met" | "not_met" | "unknown";
  detail?: string | null;
};
export type Compared = {
  campaign: {
    title: string;
    money: Inbox["campaign"]["money"];
    deliverables:
      { type: string; platform?: string; quantity: number }[] | null;
    rights: Record<string, unknown> | null;
  };
  candidates: {
    id: string;
    status: string;
    tags: string[];
    hold: { expires_at: string } | null;
    shared: {
      creator: string;
      pitch: string | null;
      answers: Record<string, string>;
      quote: { currency: string; amount: number; note?: string } | null;
      account: InboxItem["account"];
      portfolio: { ref_id: string; title: string; kind: string }[];
      kit: { kit?: { name?: string } } | null;
    };
    eligibility: { eligible: boolean; hard: Check[]; preferred: Check[] };
    proposal: {
      version: number;
      terms: {
        money?: { currency: string; amount: number };
        start_on?: string;
        end_on?: string;
        deliverables?: { type: string; quantity: number }[];
      };
    } | null;
  }[];
};
export type Candidate = {
  hold: Hold | null;
  capacity: number | null;
  taken: number;
  notes: { body: string | null; tags: string[]; at: string; author: string }[];
  handoff: string | null;
};
export const selection = {
  inbox: (c: Rpc, ws: string, campaign: string) =>
    call<Inbox>(c, "aura_selection_inbox", {
      p_workspace: ws,
      p_campaign: campaign,
    }),
  compare: (c: Rpc, ws: string, campaign: string, ids: string[]) =>
    call<Compared>(c, "aura_selection_compare", {
      p_workspace: ws,
      p_campaign: campaign,
      p_applications: ids,
    }),
  hold: (c: Rpc, ws: string, app: string, message: string | null) =>
    call<{ id: string; expires_at: string }>(c, "aura_selection_hold", {
      p_workspace: ws,
      p_application: app,
      p_message: message,
    }),
  release: (c: Rpc, ws: string, app: string) =>
    call<{ released: boolean }>(c, "aura_selection_release", {
      p_workspace: ws,
      p_application: app,
    }),
  bulk: (
    c: Rpc,
    ws: string,
    campaign: string,
    ids: string[],
    action: string,
    feedback: string | null,
  ) =>
    call<{ done: number; skipped: number }>(c, "aura_selection_bulk", {
      p_workspace: ws,
      p_campaign: campaign,
      p_applications: ids,
      p_action: action,
      p_feedback: feedback,
    }),
  note: (c: Rpc, ws: string, app: string, body: string, tags: string[]) =>
    call<{ id: string }>(c, "aura_selection_note", {
      p_workspace: ws,
      p_application: app,
      p_body: body,
      p_tags: tags,
    }),
  candidate: (c: Rpc, ws: string, app: string) =>
    call<Candidate>(c, "aura_selection_candidate", {
      p_workspace: ws,
      p_application: app,
    }),
  offer: (c: Rpc, ws: string, app: string) =>
    call<{ hold: Hold | null; handoff: string | null }>(
      c,
      "aura_selection_offer",
      { p_workspace: ws, p_application: app },
    ),
  respond: (c: Rpc, ws: string, app: string, accept: boolean) =>
    call<{ status: string; collaboration_id: string }>(
      c,
      "aura_selection_respond",
      { p_workspace: ws, p_application: app, p_accept: accept },
    ),
  handoff: (c: Rpc, ws: string, collab: string) =>
    call<string | null>(c, "aura_selection_handoff", {
      p_workspace: ws,
      p_collab: collab,
    }),
};
