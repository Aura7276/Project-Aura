import "server-only";
import {
  actingId,
  delegationFor,
  type Delegation,
} from "@/server/agency/service";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classify, type ServiceError } from "@/server/creator/service";
import { eligible } from "@/server/auth/session";
import type {
  BrandCampaign,
  Detail,
  Feed,
  Lists,
  Card,
} from "@/features/marketplace/types";

type Rpc = Pick<SupabaseClient, "rpc">;
export type MReason =
  | "verification"
  | "incomplete"
  | "state"
  | "duplicate"
  | "rate"
  | "invalid"
  | "not_found"
  | "generic";
export type MResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ServiceError; reason: MReason; detail: string | null };
const reasonOf = (code: string | null, m: string): MReason => {
  if (/verification required/i.test(m)) return "verification";
  if (/incomplete/i.test(m)) return "incomplete";
  if (/Not found/i.test(m)) return "not_found";
  if (code === "23505") return "duplicate";
  if (code === "54000") return "rate";
  if (code === "55000") return "state";
  if (code === "22023" || code === "23514") return "invalid";
  return "generic";
};
export const reasonText: Record<MReason, string> = {
  verification:
    "Publishing and invitations need an approved business verification. Your drafts stay private until then.",
  incomplete:
    "The campaign is missing required terms. Fix the items listed and try again.",
  state: "That is not possible in the campaign's current state.",
  duplicate: "You have already done that.",
  rate: "You have done that too often today.",
  invalid: "Some of that does not fit. Please check it.",
  not_found: "That campaign is not available to you.",
  generic: "We could not do that. Nothing was lost, so please try again.",
};
async function call<T>(
  c: Rpc,
  fn: string,
  args: Record<string, unknown>,
): Promise<MResult<T>> {
  const { data, error } = await c.rpc(fn, args);
  if (error || data === null || data === undefined) {
    const code = (error as { code?: string } | null)?.code ?? null;
    const msg = (error as { message?: string } | null)?.message ?? "";
    const detail = /incomplete: (.*)$/.exec(msg)?.[1] ?? null;
    return {
      ok: false,
      error: classify(error),
      reason: reasonOf(code, msg),
      detail,
    };
  }
  return { ok: true, value: data as T };
}
/** The signed-in person's Brand workspace (owner or admin). Brand owners need MFA (M02 policy, enforced by eligible()). */
export async function brandContext(preferred?: string) {
  const ctx = await eligible();
  const { data, error } = await ctx.client.rpc("aura_workspaces");
  if (error) throw new Error("Unable to load workspaces");
  const brands = (
    data as {
      id: string;
      name: string;
      kind: string;
      role: string;
      status: string;
      verification: string;
    }[]
  ).filter(
    (w) =>
      w.kind === "brand" &&
      ["owner", "admin"].includes(w.role) &&
      w.status !== "suspended",
  );
  const own = brands.find((b) => b.id === preferred);
  if (!own) {
    // M23: an Agency team member working for a Brand client. Only a live delegation is accepted; the database checks every call.
    const target = preferred ?? (await actingId());
    const d = await delegationFor(ctx.client as Rpc, target, "brand");
    if (d)
      return {
        client: ctx.client as Rpc,
        workspaceId: d.client_ws,
        name: d.name,
        verification: "pending",
        brands,
        userId: ctx.user.id,
        acting: d,
      };
  }
  const w = own ?? brands[0];
  if (!w) redirect("/workspaces");
  return {
    client: ctx.client as Rpc,
    workspaceId: w.id,
    name: w.name,
    verification: w.verification,
    brands,
    userId: ctx.user.id,
    acting: null as Delegation | null,
  };
}
export const market = {
  feed: (c: Rpc, ws: string, f: Record<string, unknown>) =>
    call<Feed>(c, "aura_market_feed", { p_workspace: ws, p_filters: f }),
  campaign: (c: Rpc, ws: string, id: string) =>
    call<Detail>(c, "aura_market_campaign", {
      p_workspace: ws,
      p_campaign: id,
    }),
  checkApply: (c: Rpc, ws: string, id: string) =>
    call<{
      eligible: boolean;
      reason: string;
      eligibility: Detail["eligibility"];
    }>(c, "aura_market_check_apply", { p_workspace: ws, p_campaign: id }),
  bookmark: (c: Rpc, ws: string, id: string, on: boolean) =>
    call<{ bookmarked: boolean }>(c, "aura_market_bookmark", {
      p_workspace: ws,
      p_campaign: id,
      p_on: on,
    }),
  lists: (c: Rpc, ws: string) =>
    call<Lists>(c, "aura_market_lists", { p_workspace: ws }),
  saveSearch: (
    c: Rpc,
    ws: string,
    name: string,
    filters: Record<string, unknown>,
    alert: boolean,
  ) =>
    call<{ id: string }>(c, "aura_market_save_search", {
      p_workspace: ws,
      p_name: name,
      p_filters: filters,
      p_alert: alert,
    }),
  deleteSearch: (c: Rpc, ws: string, id: string) =>
    call<{ deleted: string }>(c, "aura_market_delete_search", {
      p_workspace: ws,
      p_id: id,
    }),
  setAlert: (c: Rpc, ws: string, id: string, on: boolean) =>
    call<{ alert: boolean }>(c, "aura_market_set_alert", {
      p_workspace: ws,
      p_id: id,
      p_alert: on,
    }),
  hide: (c: Rpc, ws: string, kind: string, value: string, on: boolean) =>
    call<{ hidden: boolean }>(c, "aura_market_hide", {
      p_workspace: ws,
      p_kind: kind,
      p_value: value,
      p_on: on,
    }),
  readNotifications: (c: Rpc, ws: string) =>
    call<{ ok: boolean }>(c, "aura_market_read_notifications", {
      p_workspace: ws,
    }),
  report: (c: Rpc, ws: string, id: string, reason: string, details: string) =>
    call<{ id: string }>(c, "aura_market_report", {
      p_workspace: ws,
      p_campaign: id,
      p_reason: reason,
      p_details: details,
    }),
  brandPage: (c: Rpc, ws: string, brand: string) =>
    call<{
      id: string;
      name: string;
      verified_since: string | null;
      published_campaigns: number;
      campaigns: Card[];
      hidden: boolean;
    }>(c, "aura_market_brand_page", { p_workspace: ws, p_brand: brand }),
  brandState: (c: Rpc, ws: string) =>
    call<{
      verification: string;
      verified: boolean;
      campaigns: (Pick<
        BrandCampaign,
        | "id"
        | "slug"
        | "category"
        | "visibility"
        | "status"
        | "draft_version"
        | "published_version"
        | "risk_flags"
        | "review_note"
      > & {
        title: string;
        updated_at: string;
        invites: number;
        bookmarks: number;
      })[];
    }>(c, "aura_market_brand_state", { p_workspace: ws }),
  createCampaign: (
    c: Rpc,
    ws: string,
    request: string,
    category: string,
    title: string,
  ) =>
    call<{ id: string }>(c, "aura_market_create_campaign", {
      p_workspace: ws,
      p_request: request,
      p_category: category,
      p_title: title,
    }),
  brandCampaign: (c: Rpc, ws: string, id: string) =>
    call<BrandCampaign>(c, "aura_market_brand_campaign", {
      p_workspace: ws,
      p_campaign: id,
    }),
  saveCampaign: (
    c: Rpc,
    ws: string,
    id: string,
    visibility: string,
    showCount: boolean,
    content: Record<string, unknown>,
  ) =>
    call<BrandCampaign>(c, "aura_market_save_campaign", {
      p_workspace: ws,
      p_campaign: id,
      p_visibility: visibility,
      p_show_count: showCount,
      p_content: content,
    }),
  publish: (c: Rpc, ws: string, id: string) =>
    call<{ status: string; flags?: string[] }>(c, "aura_market_publish", {
      p_workspace: ws,
      p_campaign: id,
    }),
  setStatus: (c: Rpc, ws: string, id: string, action: string) =>
    call<{ status: string }>(c, "aura_market_set_status", {
      p_workspace: ws,
      p_campaign: id,
      p_action: action,
    }),
  invite: (c: Rpc, ws: string, id: string, creator: string, on: boolean) =>
    call<{ invited: boolean }>(c, "aura_market_invite", {
      p_workspace: ws,
      p_campaign: id,
      p_creator: creator,
      p_on: on,
    }),
  reviewQueue: (c: Rpc) =>
    call<{
      campaigns: {
        id: string;
        brand: string;
        category: string;
        title: string;
        summary: string;
        brief: string;
        flags: string[];
        updated_at: string;
      }[];
      reports: {
        id: string;
        campaign_id: string;
        title: string;
        brand: string;
        reason: string;
        details: string | null;
        created_at: string;
      }[];
      brands: {
        id: string;
        name: string;
        business_kind: string;
        verification: string;
        drafts: number;
      }[];
    }>(c, "aura_market_review_queue", {}),
  verifyBrand: (c: Rpc, id: string, decision: string, reason: string) =>
    call<{ verification: string }>(c, "aura_market_verify_brand", {
      p_brand: id,
      p_decision: decision,
      p_reason: reason,
    }),
  moderate: (c: Rpc, id: string, decision: string, reason: string) =>
    call<{ decision: string }>(c, "aura_market_moderate", {
      p_campaign: id,
      p_decision: decision,
      p_reason: reason,
    }),
  decideReport: (c: Rpc, id: string, decision: string, reason: string) =>
    call<{ status: string }>(c, "aura_market_decide_report", {
      p_report: id,
      p_decision: decision,
      p_reason: reason,
    }),
};
