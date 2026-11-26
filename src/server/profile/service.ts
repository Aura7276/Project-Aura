import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { classify, type ServiceError } from "@/server/creator/service";
import { providerConfig } from "@/config/environment";
import type {
  Kit,
  KitContent,
  ProfileState,
  PublicProfile,
} from "@/features/creator-profile/types";

type Rpc = Pick<SupabaseClient, "rpc">;
export type PReason =
  | "taken"
  | "reserved"
  | "format"
  | "rate"
  | "not_ready"
  | "discovery"
  | "recipient"
  | "state"
  | "invalid"
  | "generic";
export type PResult<T> =
  { ok: true; value: T } | { ok: false; error: ServiceError; reason: PReason };
const reasonOf = (code: string | null, m: string): PReason => {
  if (/reserved/i.test(m)) return "reserved";
  if (/taken/i.test(m)) return "taken";
  if (/Invalid username/i.test(m)) return "format";
  if (code === "54000") return "rate";
  if (/not ready to publish/i.test(m)) return "not_ready";
  if (/qualifying account/i.test(m)) return "discovery";
  if (/recipient/i.test(m)) return "recipient";
  if (code === "55000") return "state";
  if (code === "22023" || code === "23514") return "invalid";
  return "generic";
};
export const reasonText: Record<PReason, string> = {
  taken: "That username is taken.",
  reserved: "That word is reserved. Choose another.",
  format: "That username does not follow the rules.",
  rate: "You have done that too often recently. Please try again later.",
  not_ready: "Add a username, your name and a headline or about section first.",
  discovery:
    "Discovery needs at least one of your own accounts with 100 or more followers. Accounts are never added together.",
  recipient:
    "That recipient cannot receive a restricted link. It must be an open Brand or Agency workspace.",
  state: "That is not possible right now.",
  invalid: "Some of that does not fit. Please check it.",
  generic:
    "We could not save that. Nothing was lost on this page, so please try again.",
};
async function call<T>(
  c: Rpc,
  fn: string,
  args: Record<string, unknown>,
): Promise<PResult<T>> {
  const { data, error } = await c.rpc(fn, args);
  if (error || data === null || data === undefined) {
    const code = (error as { code?: string } | null)?.code ?? null;
    return {
      ok: false,
      error: classify(error),
      reason: reasonOf(
        code,
        (error as { message?: string } | null)?.message ?? "",
      ),
    };
  }
  return { ok: true, value: data as T };
}
/** Public pages degrade to "not found" when no data provider is configured (for example a static preview), never to an error page. */
export async function safePublic<T>(
  run: (c: Awaited<ReturnType<typeof publicClient>>) => Promise<T>,
): Promise<T | null> {
  try {
    return await run(await publicClient());
  } catch {
    return null;
  }
}
/** A read-only client for public pages: the visitor's own session if they have one, otherwise anonymous. It never writes cookies. */
export async function publicClient() {
  const { url, key } = providerConfig();
  const jar = await cookies();
  return createServerClient(url, key, {
    cookies: { getAll: () => jar.getAll(), setAll: () => {} },
  });
}
export const profileApi = {
  state: (c: Rpc, ws: string) =>
    call<ProfileState>(c, "aura_profile_state", { p_workspace: ws }),
  save: (c: Rpc, ws: string, patch: Record<string, unknown>) =>
    call<ProfileState>(c, "aura_profile_save", {
      p_workspace: ws,
      p_patch: patch,
    }),
  publish: (c: Rpc, ws: string, publish: boolean, listed: boolean) =>
    call<{ checks: Record<string, boolean> }>(c, "aura_profile_publish", {
      p_workspace: ws,
      p_publish: publish,
      p_listed: listed,
    }),
  preview: (c: Rpc, ws: string) =>
    call<
      PublicProfile & { checks: Record<string, boolean>; published: boolean }
    >(c, "aura_profile_preview", { p_workspace: ws }),
  saveItem: (
    c: Rpc,
    ws: string,
    request: string | null,
    id: string | null,
    item: Record<string, unknown>,
  ) =>
    call<{ id: string }>(c, "aura_profile_save_item", {
      p_workspace: ws,
      p_request: request,
      p_id: id,
      p_item: item,
    }),
  saveService: (
    c: Rpc,
    ws: string,
    id: string | null,
    s: Record<string, unknown>,
  ) =>
    call<{ id: string }>(c, "aura_profile_save_service", {
      p_workspace: ws,
      p_id: id,
      p_s: s,
    }),
  savePackage: (
    c: Rpc,
    ws: string,
    id: string | null,
    k: Record<string, unknown>,
  ) =>
    call<{ id: string }>(c, "aura_profile_save_package", {
      p_workspace: ws,
      p_id: id,
      p_k: k,
    }),
  saveExperience: (
    c: Rpc,
    ws: string,
    id: string | null,
    e: Record<string, unknown>,
  ) =>
    call<{ id: string }>(c, "aura_profile_save_experience", {
      p_workspace: ws,
      p_id: id,
      p_e: e,
    }),
  remove: (c: Rpc, ws: string, kind: string, id: string) =>
    call<{ deleted: string }>(c, "aura_profile_delete", {
      p_workspace: ws,
      p_kind: kind,
      p_id: id,
    }),
  createInvite: (c: Rpc, ws: string, label: string) =>
    call<{ id: string; token: string; expires_at: string }>(
      c,
      "aura_profile_create_invite",
      { p_workspace: ws, p_label: label },
    ),
  revokeInvite: (c: Rpc, ws: string, id: string) =>
    call<{ revoked: string }>(c, "aura_profile_revoke_invite", {
      p_workspace: ws,
      p_invite: id,
    }),
  inviteInfo: (c: Rpc, token: string) =>
    call<{ valid: boolean; display_name?: string; expires_at?: string }>(
      c,
      "aura_profile_invite_info",
      { p_token: token },
    ),
  submitTestimonial: (
    c: Rpc,
    token: string,
    v: {
      author_name: string;
      author_role: string;
      relationship: string;
      body: string;
    },
  ) =>
    call<{ id: string; status: string }>(c, "aura_profile_submit_testimonial", {
      p_token: token,
      p_author_name: v.author_name,
      p_author_role: v.author_role,
      p_relationship: v.relationship,
      p_body: v.body,
    }),
  testimonialAction: (
    c: Rpc,
    ws: string,
    id: string,
    action: string,
    reason: string | null,
  ) =>
    call<{ id: string }>(c, "aura_profile_testimonial_action", {
      p_workspace: ws,
      p_id: id,
      p_action: action,
      p_reason: reason,
    }),
  moderationQueue: (c: Rpc) =>
    call<
      {
        id: string;
        status: string;
        author_name: string;
        relationship: string;
        body: string;
        dispute_reason: string | null;
        created_at: string;
        creator: string;
      }[]
    >(c, "aura_profile_moderation_queue", {}),
  moderate: (c: Rpc, id: string, decision: string, reason: string) =>
    call<{ id: string }>(c, "aura_profile_moderate", {
      p_id: id,
      p_decision: decision,
      p_reason: reason,
    }),
  createKit: (
    c: Rpc,
    ws: string,
    request: string,
    kit: Record<string, unknown>,
  ) =>
    call<{ id: string }>(c, "aura_profile_create_kit", {
      p_workspace: ws,
      p_request: request,
      p_kit: kit,
    }),
  saveKit: (
    c: Rpc,
    ws: string,
    id: string,
    meta: Record<string, unknown>,
    sections: unknown[] | null,
  ) =>
    call<{ id: string }>(c, "aura_profile_save_kit", {
      p_workspace: ws,
      p_kit: id,
      p_meta: meta,
      p_sections: sections,
    }),
  kits: (c: Rpc, ws: string, id: string | null = null) =>
    call<Kit[]>(c, "aura_profile_kits", { p_workspace: ws, p_kit: id }),
  kitPreview: (
    c: Rpc,
    ws: string,
    id: string,
    restricted: boolean,
    rates: boolean,
    version: string | null = null,
  ) =>
    call<KitContent>(c, "aura_profile_kit_preview", {
      p_workspace: ws,
      p_kit: id,
      p_restricted: restricted,
      p_rates: rates,
      p_version: version,
    }),
  snapshot: (c: Rpc, ws: string, id: string, note: string) =>
    call<{ id: string; version: number }>(c, "aura_profile_snapshot_kit", {
      p_workspace: ws,
      p_kit: id,
      p_note: note,
    }),
  createShare: (
    c: Rpc,
    ws: string,
    kit: string,
    v: {
      kind: string;
      recipient: string | null;
      version: string | null;
      include_rates: boolean;
      label: string;
      days: number | null;
    },
  ) =>
    call<{
      id: string;
      token: string;
      kind: string;
      expires_at: string | null;
    }>(c, "aura_profile_create_share", {
      p_workspace: ws,
      p_kit: kit,
      p_kind: v.kind,
      p_recipient: v.recipient,
      p_version: v.version,
      p_include_rates: v.include_rates,
      p_label: v.label,
      p_days: v.days,
    }),
  revokeShare: (c: Rpc, ws: string, id: string) =>
    call<{ revoked: string }>(c, "aura_profile_revoke_share", {
      p_workspace: ws,
      p_share: id,
    }),
  analytics: (c: Rpc, ws: string, days: number) =>
    call<{
      days: number;
      profile_views: { day: string; views: number }[];
      kit_views: { kit: string; link: string; views: number }[];
      brand_visits: { brand: string; kit: string; at: string }[];
      enquiries: number;
    }>(c, "aura_profile_analytics", { p_workspace: ws, p_days: days }),
  publicProfile: (c: Rpc, username: string) =>
    call<{ found: boolean; redirect?: string; profile?: PublicProfile }>(
      c,
      "aura_public_profile",
      { p_username: username },
    ),
  publicKit: (c: Rpc, token: string, shareAs: string | null = null) =>
    call<{
      status:
        | "ok"
        | "not_found"
        | "revoked"
        | "expired"
        | "sign_in_required"
        | "not_permitted";
      kind?: string;
      snapshot?: boolean;
      expires_at?: string | null;
      content?: KitContent;
      viewer_brands?: { id: string; name: string }[];
    }>(c, "aura_public_kit", { p_token: token, p_share_identity_as: shareAs }),
};
