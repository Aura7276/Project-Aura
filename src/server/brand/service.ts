import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { classify, type ServiceError } from "@/server/creator/service";
import { brandContext } from "@/server/market/service";
import type { BrandState } from "@/features/brand/rules";

type Rpc = Pick<SupabaseClient, "rpc">;
export type BReason =
  | "mfa"
  | "missing"
  | "declaration"
  | "verification"
  | "limit"
  | "duplicate"
  | "state"
  | "invalid"
  | "rate"
  | "about"
  | "slug"
  | "generic";
export type BResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ServiceError; reason: BReason; detail?: string };
const reasonOf = (code: string | null, m: string): BReason => {
  if (/Missing evidence/i.test(m)) return "missing";
  if (/declaration/i.test(m)) return "declaration";
  if (/verification required/i.test(m)) return "verification";
  if (/about text/i.test(m)) return "about";
  if (/address/i.test(m) && code !== "23505") return "slug";
  if (code === "54000") return /Rate/i.test(m) ? "rate" : "limit";
  if (code === "23505") return "duplicate";
  if (code === "55000") return "state";
  if (
    code === "22023" ||
    code === "23514" ||
    code === "22P02" ||
    code === "22007" ||
    code === "22008"
  )
    return "invalid";
  if (code === "42501") return "mfa";
  return "generic";
};
export const reasonText: Record<BReason, string> = {
  mfa: "You need to be an owner or admin of this Brand, signed in with your authenticator.",
  missing:
    "Some required evidence is missing. The highlighted fields are needed for your business type.",
  declaration: "Tick the declaration before submitting.",
  verification: "This needs an approved business verification first.",
  limit: "You have reached the limit for this list.",
  duplicate: "That already exists.",
  state: "That is not possible at this stage.",
  invalid: "Some of that is missing or does not fit. Please check it.",
  rate: "You have reached today's limit. Please try again tomorrow.",
  about: "Write an about text of at least 40 characters first.",
  slug: "Use 3 to 40 lowercase letters, digits and single dashes, and avoid reserved words.",
  generic: "We could not do that. Nothing was lost, so please try again.",
};
async function call<T>(
  c: Rpc,
  fn: string,
  args: Record<string, unknown>,
): Promise<BResult<T>> {
  const { data, error } = await c.rpc(fn, args);
  if (error || data === null || data === undefined) {
    const e = error as { code?: string; message?: string } | null;
    const m = e?.message ?? "";
    return {
      ok: false,
      error: classify(error),
      reason: reasonOf(e?.code ?? null, m),
      detail: /Missing evidence: (.*)/.exec(m)?.[1],
    };
  }
  return { ok: true, value: data as T };
}
type J = Record<string, unknown>;
export const brand = {
  state: (c: Rpc, ws: string) =>
    call<BrandState>(c, "aura_brand_state", { p_workspace: ws }),
  saveProfile: (c: Rpc, ws: string, f: J) =>
    call<J>(c, "aura_brand_save_profile", { p_workspace: ws, p_fields: f }),
  complete: (c: Rpc, ws: string) =>
    call<J>(c, "aura_brand_complete_onboarding", { p_workspace: ws }),
  saveGoal: (c: Rpc, ws: string, id: string | null, f: J) =>
    call<J>(c, "aura_brand_save_goal", {
      p_workspace: ws,
      p_id: id,
      p_fields: f,
    }),
  saveSegment: (c: Rpc, ws: string, id: string | null, f: J) =>
    call<J>(c, "aura_brand_save_segment", {
      p_workspace: ws,
      p_id: id,
      p_fields: f,
    }),
  saveProduct: (c: Rpc, ws: string, id: string | null, f: J) =>
    call<J>(c, "aura_brand_save_product", {
      p_workspace: ws,
      p_id: id,
      p_fields: f,
    }),
  saveCompetitor: (c: Rpc, ws: string, f: J) =>
    call<J>(c, "aura_brand_save_competitor", { p_workspace: ws, p_fields: f }),
  saveSocial: (c: Rpc, ws: string, f: J) =>
    call<J>(c, "aura_brand_save_social", { p_workspace: ws, p_fields: f }),
  remove: (c: Rpc, ws: string, kind: string, id: string) =>
    call<J>(c, "aura_brand_delete", {
      p_workspace: ws,
      p_kind: kind,
      p_id: id,
    }),
  saveGuideline: (c: Rpc, ws: string, f: J) =>
    call<J>(c, "aura_brand_save_guideline", { p_workspace: ws, p_fields: f }),
  saveBudget: (c: Rpc, ws: string, f: J | null) =>
    call<J>(c, "aura_brand_save_budget", { p_workspace: ws, p_fields: f }),
  savePref: (c: Rpc, ws: string, f: J) =>
    call<J>(c, "aura_brand_save_creator_pref", {
      p_workspace: ws,
      p_fields: f,
    }),
  saveMaturity: (c: Rpc, ws: string, a: J) =>
    call<J>(c, "aura_brand_save_maturity", { p_workspace: ws, p_answers: a }),
  savePlan: (c: Rpc, ws: string, horizon: number, items: unknown[]) =>
    call<J>(c, "aura_brand_save_plan", {
      p_workspace: ws,
      p_horizon: horizon,
      p_items: items,
    }),
  planItem: (
    c: Rpc,
    ws: string,
    id: string | null,
    action: string,
    title?: string,
    detail?: string,
    horizon?: number,
  ) =>
    call<J>(c, "aura_brand_plan_item", {
      p_workspace: ws,
      p_id: id,
      p_action: action,
      p_title: title ?? null,
      p_detail: detail ?? null,
      p_horizon: horizon ?? null,
    }),
  checkSlug: (c: Rpc, ws: string, slug: string) =>
    call<{ ok: boolean; reason?: string }>(c, "aura_brand_check_slug", {
      p_workspace: ws,
      p_slug: slug,
    }),
  publish: (c: Rpc, ws: string, on: boolean, slug: string | null) =>
    call<J>(c, "aura_brand_publish", {
      p_workspace: ws,
      p_on: on,
      p_slug: slug,
    }),
  publicFor: (c: Rpc, ws: string, brandId: string) =>
    call<{ found: boolean; profile?: PublicBrand }>(
      c,
      "aura_brand_public_for",
      { p_workspace: ws, p_brand: brandId },
    ),
  caseSave: (c: Rpc, ws: string, f: J) =>
    call<J>(c, "aura_brand_verification_save", {
      p_workspace: ws,
      p_fields: f,
    }),
  caseSubmit: (c: Rpc, ws: string, declare: boolean) =>
    call<{ paused: boolean }>(c, "aura_brand_verification_submit", {
      p_workspace: ws,
      p_declare: declare,
    }),
  caseWithdraw: (c: Rpc, ws: string) =>
    call<J>(c, "aura_brand_verification_withdraw", { p_workspace: ws }),
  caseAppeal: (c: Rpc, ws: string, reason: string) =>
    call<J>(c, "aura_brand_verification_appeal", {
      p_workspace: ws,
      p_reason: reason,
    }),
  reviewQueue: (c: Rpc) => call<J[]>(c, "aura_brand_review_queue", {}),
  reviewCase: (c: Rpc, id: string) =>
    call<J>(c, "aura_brand_review_case", { p_case: id }),
  reviewDecide: (c: Rpc, id: string, decision: string, reason: string) =>
    call<J>(c, "aura_brand_review_decide", {
      p_case: id,
      p_decision: decision,
      p_reason: reason,
    }),
};
export type PublicBrand = {
  slug: string;
  name: string;
  tagline: string | null;
  about: string | null;
  industry: string | null;
  country: string;
  website: string | null;
  verified_since: string | null;
  products: {
    name: string;
    kind: string;
    description: string | null;
    url: string | null;
  }[];
  socials: { platform: string; handle: string }[];
  live_campaigns: number;
};
/** The selected Brand workspace plus its M14 state. Without a profile, onboarding starts. */
export async function brandArea(
  w?: string,
  opts: { allowEmpty?: boolean } = {},
) {
  const b = await brandContext(w);
  const r = await brand.state(b.client, b.workspaceId);
  if (!r.ok) throw new Error("brand:" + r.error);
  if (!r.value.profile && !opts.allowEmpty)
    redirect(`/brand/onboarding?w=${b.workspaceId}`);
  return { ...b, s: r.value };
}
